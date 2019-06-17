---
title:  Introducing distributed tracing in your Python application via Zipkin
date: 2017-03-28
categories:
-  Python
aliases:
- /introducing-distributed-tracing-in-your-python-application-via-zipkin.html
---

Distributed tracing is the idea of tracing a network request as it travels through your services, as it would be in a microservices based architecture. The primary reason you may want to do is to troubleshoot or monitor the latency of a request
as it travels through the different services.

In this post we will see a demo of how we can introduce distributed tracing into a Python network stack communicating via HTTP. 
We have a service ``demo`` which is a Flask application, which listens on ``/``. The handler for ``/`` calls another service ``service1`` via HTTP. We want to be able to see how much time a request spends in each service by introducing distributed tracing. Before we get to the code, let's talk briefly about a few concepts.

Distributed Tracing concepts
============================

Roughly, a call to an "external service" starts a `span`. We can have a `span` nested within another span in a tree like fashion. All the spans in the context of a single request would form a `trace`. 

Something like the following would perhaps explain it better in the context of our ``demo`` and ``service`` network application stack:

.. code::

                   <--------------------          Trace       ------------------------------------ >  
                                       Start Root Span                        Start a nested span  
   External Request -> Demo HTTP app       --->          Service 1 HTTP app        --->          Process
   

The span that is started from the ``service1`` is designated as a child of the ``root span`` which was started from the ``demo`` application. In the context of Python, we can think of a span as a context manager and one context manager living within another context manager. And all these "contexts" together forming a trace.

From the above it is somewhat clear (or not) that, the start of each span initiates a "timer" which then on the request's way back (or end of the span) is used to calculate the time the span lasted for. So, we need to have some thing (or things) which has to:

- Emit these data
- Recieve these data 
- Allow us to collate them together and make it available to us for each trace or request. 

This brings us to our next section.

Zipkin
======

`zipkin <http://zipkin.io/>`__ is a distributed tracing system which gives us the last two of the above requirements. How we emit these data from our application (the first point above) is dependent on the language we have written the application in and the distributed tracing system we chose for the last two requirements. In our case, `py_zipkin <https://github.com/Yelp/py_zipkin>`__ solves our problem.

First, we will start ``zipkin`` with ``elasticsearch`` as the backend as ``docker containers``. So, you need to have ``docker`` installed. To get the data in ``elasticsearch`` persisted, we will first create a `data container <http://echorand.me/data-only-docker-containers.html>`__ as follows:

.. code::

    $ docker create --name esdata openzipkin/zipkin-elasticsearch
    
Then, download my code from `here <https://github.com/amitsaha/python-web-app-recipes/archive/zipkin_python_demo.zip>`__ and:

.. code::

    $ wget ..
    $ unzip ..
    $ cd tracing/http_collector
    $ ./start_zipkin.sh
    ..
    ..
    zipkin          | 2017-03-28 03:48:00.936  INFO 9 --- [           main] zipkin.server.ZipkinServer
    Started ZipkinServer in 7.36 seconds (JVM running for 8.595)
    
If you now go to ``http://localhost:9411/`` in your browser, you will see the Zipkin Web UI.

Creating traces
===============

Now, let's install the two libraries we need from the ``requirements.txt`` via ``pip install -r requirements.txt``. 

Let's now start our two services, first the "external" facing demo service:

.. code::

    $ python demo.py
   
    * Running on http://127.0.0.1:5000/ (Press CTRL+C to quit)
    * Restarting with stat
    * Debugger is active!
    * Debugger pin code: 961-605-579

Then, the "internal" service 1:

.. code::

    $ python service1.py 
    * Running on http://127.0.0.1:6000/ (Press CTRL+C to quit)
    * Restarting with stat
    * Debugger is active!
    * Debugger pin code: 961-605-579
    
  
Now, let's make couple of requests to the ``demo`` service using ``$ curl localhost:5000`` twice. If we go back to the Zipkin Web UI and click on "Find Traces", we will see something like this:
 
.. image:: {filename}/images/zipkin-traces.png
   :align: center
   
If we click on one of the traces, we will see something like this:
 
.. image:: {filename}/images/zipkin-trace1.png
   :align: center
 
As we can see four spans were created (two spans in each service) with the 2nd, 3rd and 4th spans nested inside the first span. The time reported to be spent in each span will become clear next.

Application code
================

Let's look at the ``demo.py`` file first:

.. code::

    @zipkin_span(service_name='webapp', span_name='do_stuff')
    def do_stuff():
        time.sleep(5)
        headers = create_http_headers_for_new_span()
        requests.get('http://localhost:6000/service1/', headers=headers)
        return 'OK'

    @app.route('/')
    def index():
        with zipkin_span(
            service_name='webapp',
            span_name='index',
            transport_handler=http_transport,
            port=5000,
            sample_rate=100, #0.05, # Value between 0.0 and 100.0
        ):
            do_stuff()
            time.sleep(10)
        return 'OK', 200


We create the first span inside the ``/`` handler function ``index()`` via the ``zipkin_span()`` context manager.
We specify the ``sample_rate=100`` meaning it will trace every request (only for demo). The ``transport_handler``
specifies "how" the emitted traces are transported to the Zipkin "collector". Here we use the ``http_transport``
provided as example by the ``py_zipkin`` project.

This handler function calls the ``do_stuff()`` function where we create another span, but since it is in the same
service, we specify the same ``service_name`` and decorate it with the ``zipkin_span`` decorator. We have an artificial
time delay of 5s before we make a HTTP call to the ``service1`` service. Since we want to continue the current span, we 
pass in the span data as HTTP headers. These headers are created via the helper function, ``create_http_headers_for_new_span()`` provided via ``py_zipkin``.

Let's look at the ``service1.py`` file next:

.. code::

    @zipkin_span(service_name='service1', span_name='service1_do_stuff')
    def do_stuff():
        time.sleep(5)
        return 'OK'

    @app.route('/service1/')
    def index():
        with zipkin_span(
            service_name='service1',
            zipkin_attrs=ZipkinAttrs(
                trace_id=request.headers['X-B3-TraceID'],
                span_id=request.headers['X-B3-SpanID'],
                parent_span_id=request.headers['X-B3-ParentSpanID'],
                flags=request.headers['X-B3-Flags'],
                is_sampled=request.headers['X-B3-Sampled'],
            ),
            span_name='index_service1',
            transport_handler=http_transport,
            port=6000,
            sample_rate=100, #0.05, # Value between 0.0 and 100.0
        ):
            do_stuff()
        return 'OK', 200

This is almost the same as our ``demo`` service above, but note how we set the ``zipkin_attrs`` by making using of the
headers we were passed from the ``demo`` service aboev. This makes sure that the span of ``service1`` is nested within
the span of ``demo``. Note once again, how we introduce artificial delays here once again to make the trace show
the time spent in each service more clearly.

Ending Notes
============

Hopefully this post has given you a starting point of how you may go about implement distributed tracing. The following links
has more:

- `zipkin <zipkin.io>`__
- `opentracing <http://opentracing.io/>`__
