---
title: Pyodide, PyScript - Monkey patching requests
date: 2022-05-08
categories:
-  python
---

At PyCon US 2022, Anaconda announced [PyScript: Python in the Browser](https://anaconda.cloud/pyscript-python-in-the-browser).
So far my understanding is that it builds on [Pyodide](https://pyodide.org/) and makes it magically
easy to bridge the world of the Browser - the Document Object Model (DOM) and Python. It's so magical
that you can simply copy scripts that you were running using Python installed on a computer and
they just run in the browser. Check out the blog post for some demos.

To explore it with some definite goal in mind, I started porting some programs from my book, "Doing Math with Python",
and things mostly worked as they were. This blog post aims to discuss a specific problem 
I came across while porting these programs and how I solved it.

# Monkey patching requests

The [requests](https://docs.python-requests.org/en/latest/) package is widely used in the Python ecosystem whenever there is a need to make network
requests. However, due to limitations of the networking stack in CPython's WebAssembly, you cannot use it
with Pyodide and hence, PyScript. This means that if you were trying to use a package which uses 
`requests` to make HTTP requests, you would not be able to get the functionality working in PyScript.

In my case, I was trying to use the [pyowm](https://pyowm.readthedocs.io/en/latest/index.html) package to fetch
weather forecast data which was only making HTTP GET requests. Hence, the solution suggested by Hood in the 
Pyodide Gitter channel was to monkey patch the relevant code
to use the [pyodide.open_url()](https://pyodide.org/en/stable/usage/api/python-api.html?highlight=open_url#pyodide.open_url)
function.

First, I  implement a just enough `MyResponse` class to encapsulate the response:

```python
class MyResponse:
    def __init__(self, status_code, message, json_body):
        self.status_code = status_code
        self.text = message
        self.json_body = json_body

    def json(self):
       return self.json_body
```  

The class contains just enough attributes and functions needed by `pyowm` and specifically,
the functionality I am using.

Then, I create a `JustEnoughRequests` class to implement a `get()` method which will call the
`pyodide.open_url()` function referred to earlier, essentially, intercepting the call to the
`requests.get()` function and instead using the `pyodide.open_url()` function to make the
HTTP GET call:

```python
class JustEnoughRequests:
    def __init__(self):
        pass

    def get(self, uri, **kwargs):
        print("Sending request to:", uri)
        print("Got kwargs, igoring everyting other than params", kwargs)
        query_params = []
        for k, v in kwargs["params"].items():
            query_params.append(k + "=" + v) 
        query_string = "&".join(query_params)
        response = pyodide.open_url(uri + "?" + query_string)
        json_response = response.getvalue()
        d = json.loads(json_response)
        return MyResponse(int(d["cod"]), d["message"], json.loads(json_response))
 
just_enough_requests = JustEnoughRequests()
```

As you can see in the implementation of the `get()` method, it accepts one positional argument
and one or more keyword arguments. From the keyword arguments it is called with, it ignores all,
but the `params` keyword argument from which it constructs the query parameters, appends
them to the `uri` (the target HTTP request host and path) and then invokes the `pyodide.open_url()`
function. This function returns a `io.StringIO()` object, hence, we use the `getvalue()` method
to get the JSON encoded data. The JSON response from the Open Weathter Map API contains a field,
`cod` containing the HTTP status code, `message` containing any error message and other data
relevant to the request made as key-value pairs. We encapsulate the result in a `MyResponse` object
and return it.

Then, we create an object of type, `JustEnoughRequests` which will be what we replace the 
`requests` module with.

The patching is done as follows:

```python
with mock.patch('pyowm.commons.http_client.requests', just_enough_requests):
    # Get a token from https://home.openweathermap.org/users/sign_up
    owm = OWM('your token')
    mgr = owm.weather_manager()
    three_h_forecast = mgr.forecast_at_place('new york, us', '3h').forecast
```

And that's it. Here's a complete [HTML file](https://raw.githubusercontent.com/doingmathwithpython/code/master/explorations/PyScript/chap2/nyc_forecast_owm.html) which you can download. You will need an API key from open weather map. Once you have replaced 
the token in code, and open in your browser, you should see a graph. 

![Graph of the forecast temperature](/img/py_script_owm.png "Graph of the forecast temperature")

If nothing seems to happen, open the Console to look for any error logs.

# Summary

Now, of course, how you patch some other code which uses the requests package will vary. The key is to ensure that
you are choosing the right _namespace_ to patch in. Additionally, how much of the `requests` package you will
need to implement also determines how simple or convoluted the patching gets.

Have a look at this [github issue](https://github.com/pyscript/pyscript/issues/225#issuecomment-1118380014) for
PyScipt and the linked Pyodide issue to learn more and what's happening in this space.
