---
title:  Your options for monitoring multi-process Python applications with Prometheus
date: 2018-01-24
categories:
-  Python
aliases:
- /your-options-for-monitoring-multi-process-python-applications-with-prometheus.html
---

In an earlier article, [Monitoring Your Synchronous Python Web Applications Using Prometheus](https://blog.codeship.com/monitoring-your-synchronous-python-web-applications-using-prometheus/), I discussed a limitation of using the Python client for prometheus. 

##  Limitation of native prometheus exporting

[prometheus](https://prometheus.io) was built with single process multi-threaded applications in mind.
I use the term multi-threaded here to also include coroutine based concurrent applications such as
those written in `golang` or using Python's asynchronous primitives 
(Example: [Monitoring Your Asynchronous Python Web Applications Using Prometheus](https://blog.codeship.com/monitoring-your-asynchronous-python-web-applications-using-prometheus/)). Perhaps, that is a result of prometheus expecting that the 
application which we are monitoring has the full responsibility of the absolute value of the metric values. 
This is different from [statsd](https://github.com/etsy/statsd/blob/master/docs/metric_types.md), 
where the application can specify the operation (`increment`, `decrement` a counter,
for example) to perform on a metric rather than its absolute value.

As a result of the above, problem arises when you try to integrate prometheus into Python WSGI applications which are usually deployed
using multiple processes via `uwsgi`or `gunicorn`. When you have these multi-process applications 
running as a single application instance, you get into a situation where any of the multiple workers
can respond to prometheus's scraping request.  Each worker then responds with a value for a metric
that it knows of. You can have one scrape response having a value
of a `counter` metric as `200` and the immediate next scrape having a counter value of `100`. 
The same inconsistent behaviour can happen with a `gauge` or a `histogram`. 

However, what you really want is each scraping response to return the application level values for a
metric rather worker level. (Aside: this is each worker behaving in [WYSIATI](https://jeffreysaltzman.wordpress.com/2013/04/08/wysiati/) manner
).

What can we do? We have a few options.

## Option #1 - Add a unique label to each metric

To work around this problem, you can add a unique `worker_id` as a label such that each metric as scraped
by prometheus is unique for one application instance (by virtue of having different value for the 
label, `worker_id`). Then we can perform aggregation such as:

```
sum by (instance, http_status) (sum without (worker_id) (rate(request_count[5m])))
```

This will perform the aggregation across all `worker_id` metrics (basically ignoring it)
and then we can group by the `instance` and any other label associated to the metric
of interest.

One point worth noting here is that this leads to a [proliferation](https://prometheus.io/docs/practices/naming/) 
of metrics: for a single metric we now have `# of workers x metric` number of 
metrics per application instance. 

A demo of this approach can be found [here](https://github.com/amitsaha/python-prometheus-demo/tree/master/flask_app_prometheus_worker_id).

## Option #2: Multi-process mode

The prometheus [Python Client](https://github.com/prometheus/client_python)
has a multi-processing mode which essentially creates a shared prometheus registry and shares
it among all the processes and hence the [aggregation](https://github.com/prometheus/client_python/blob/master/prometheus_client/multiprocess.py
) happens at the application level. When,
prometheus scrapes the application instance, no matter which worker responds to the scraping
request, the metrics reported back describes the application's behaviour, rather than 
the worker responding.

A demo of this approach can be found [here](https://github.com/amitsaha/python-prometheus-demo/tree/master/flask_app_prometheus_multiprocessing).

## Option #3: The Django way

The Django prometheus client adopts an approach where you basically have each [worker listening](https://github.com/korfuri/django-prometheus/blob/master/documentation/exports.md) on a unique
port for prometheus's scraping requests. Thus, to prometheus, each of these workers are different targets
as if they were running on different instances of the application.

## Option #4: StatsD exporter

I discussed this solution in [Monitoring Your Synchronous Python Web Applications Using Prometheus](https://blog.codeship.com/monitoring-your-synchronous-python-web-applications-using-prometheus/). Essentially, instead of exporting native prometheus metrics from your
application and prometheus scraping our application, we push our metrics to a locally running [statsd exporter](https://github.com/prometheus/statsd_exporter) instance. Then, we setup prometheus to scrape the statsd exporter instance.

For Django, we can use a similar approach as well.

## Exporting metrics for non-HTTP applications

For non-HTTP applications (such as Thrift or gRPC servers), we have two options as far as I see it.

The first option is to setup a basic HTTP server (in a separate thread or process) which responds
to requests for the `/metrics` endpoint. If we have a master process which then forks the child 
processes from within the application, we may be able to get native prometheus metrics without
the limitation that Python HTTP applications (in this context) suffer.

The second option is to push the metrics to the statsd exporter. This is simpler since we don't have
to have a HTTP server running.

## Conclusion

Option #4 (using the `statsd exporter`) seems to be the best option to me especially when we have to manage/work with
both WSGI and non-HTTP multi-process applications. Combined with the [dogstatsd-py](https://github.com/DataDog/datadogpy)
client for StatsD, I think it is a really powerful option and the most straightforward. You just run
an instance of `statsd exporter` for each application instance (or share among multiple instances) and
we are done. 

This option  becomes even more attractive if we are migrating from using `statsd` to prometheus:

- Replace the native statsd client by `dogstatsd-py`
- Point the DNS for the statsd host to the `statsd exporter` instance instead

If I am wrong in my thinking here, please let me know.

## Learn more

- [Monitoring Your Synchronous Python Web Applications Using Prometheus](https://blog.codeship.com/monitoring-your-synchronous-python-web-applications-using-prometheus/)
- [Python prometheus client](https://github.com/prometheus/client_python)
- [Common query patterns in PromQL](https://www.robustperception.io/common-query-patterns-in-promql/)

## Acknowledgements

Thanks to Hynek Schlawack for a private email discussion on Python + prometheus. On their suggestion
I tried using the `worker_id` approach and took another look at the multiprocessing support in
the Python client.
