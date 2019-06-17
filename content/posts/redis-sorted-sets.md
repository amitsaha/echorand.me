---
title:  Sorted Sets in Redis from CLI, Python and Golang
date: 2018-02-19
categories:
-  software
aliases:
- /sorted-sets-in-redis-from-cli-python-and-golang.html
---


In this post, we will see a demo of *sorted sets* in [redis](https://redis.io/). I just learned about them and I think they are really cool! This post shows how we can play with sorted sets first via the `redis-cli`, then from Python and Golang.

```
                            ┌────────────┐
 .───────────────.          │            │           .─────────────.
(    Redis CLI    )   ───▶  │   Redis    │  ◀─────  (    Golang     )
 `───────────────'          │            │           `─────────────'
                            └────────────┘
                                  ▲
                                  │
                                  │
                           .─────────────.
                          (    Python     )
                           `─────────────'
```
We will first need a local redis server running. We will see how we do so on Fedora Linux next. If you are running 
another operating system, please see the [download page](https://redis.io/download).

## Installation and server setup on Fedora Linux

We can install `redis` server using `dnf`, like so:

```
$ sudo dnf install redis
..
$ redis-server --version
Redis server v=4.0.6 sha=00000000:0 malloc=jemalloc-4.5.0 bits=64 build=427484a80e1b4515
```

Let's start the server:

```
$ sudo systemctl start redis
$ sudo systemctl status redis
● redis.service - Redis persistent key-value database
   Loaded: loaded (/usr/lib/systemd/system/redis.service; disabled; vendor preset: disabled)
  Drop-In: /etc/systemd/system/redis.service.d
           └─limit.conf
   Active: active (running) since Sun 2018-02-18 00:08:22 AEDT; 4s ago
 Main PID: 29944 (redis-server)
    Tasks: 4 (limit: 4915)
   CGroup: /system.slice/redis.service
           └─29944 /usr/bin/redis-server 127.0.0.1:6379

Feb 18 00:08:22 fedora.home systemd[1]: Starting Redis persistent key-value database...
Feb 18 00:08:22 fedora.home systemd[1]: Started Redis persistent key-value database.
..
```

## Check if Redis is alive

Once the server has started, let's check if our server is up and running:

```
$ redis-cli ping
PONG
```

## Sorted Sets

Redis' sorted set is a set data structure but each element in the set is also associated with a `score`. It is a
hash map but with an interesting property - the set is ordered based on this `score` value. 

This allows us to perform the following operations easily:

- Retrieve the top or bottom 10 keys based on the score
- Find the rank/position of a key in the set
- The score of a key can be updated anytime while the set will be adjusted (if needed) based on the new score

The section on sorted sets [here](https://redis.io/topics/data-types#sorted-sets) and [here](https://redis.io/topics/data-types-intro) in the Redis docs has more details on this.

## Example scenario: Top tags

We will now create a sorted set called `tags`. This set will store tags for posts in a blog or some other content
system where entries can have one or more tags associated with them. At any given point of time, we would like to
know what are the top 5 tags in our system.

## `redis-cli` demo

We will first add a few tags to our sorted set `tags` using the [ZADD](https://redis.io/commands/zadd) command:

```
127.0.0.1:6379> ZADD tags 1 "python"
(integer) 1
127.0.0.1:6379> ZADD tags 1 "golang"
(integer) 1
127.0.0.1:6379> ZADD tags 1 "redis"
(integer) 1
127.0.0.1:6379> ZADD tags 1 "flask"
(integer) 1
127.0.0.1:6379> ZADD tags 1 "rust"
(integer) 1
127.0.0.1:6379> ZADD tags 2 "rust"
(integer) 0
127.0.0.1:6379> ZADD tags 3 "python"
(integer) 0
127.0.0.1:6379> ZADD tags 1 "docker"
(integer) 1
127.0.0.1:6379> ZADD tags 1 "linux"
(integer) 1
127.0.0.1:6379> ZADD tags 1 "c"
(integer) 1
127.0.0.1:6379> ZADD tags 1 "software"
(integer) 1
1
127.0.0.1:6379> ZADD tags 1 "memcache"
(integer) 1

```

Above, I used the command to update the score of `rust` and `python` twice to be 2 and 3 respectively. I could have used
[ZINCRBY](https://redis.io/commands/zincrby) as well. Now, I will list all the keys using the [zrange](https://redis.io/commands/zrange) command:

```
127.0.0.1:6379> zrange tags 0 -1
 1) "c"
 2) "docker"
 3) "flask"
 4) "golang"
 5) "linux"
 6) "memcache"
 7) "redis"
 8) "software"
 9) "rust"
10) "python"
```

Note how the last two keys are `rust` and `python` - as they have the highest scores (2 and 3 respectively). The others are
sorted lexicographically. 

To reverse the order, we will use the [zrevrange](https://redis.io/commands/zrevrange) command:

```
127.0.0.1:6379> ZREVRANGE tags 0 -1 withscores
 1) "python"
 2) "3"
 3) "rust"
 4) "2"
 5) "redis"
 6) "1"
 7) "golang"
 8) "1"
 9) "flask"
10) "1"

```

Above, we can see how with the `withscores` command, we also get the scores back.

Now, to get the top 5 tags, we will do the following:

```
127.0.0.1:6379> ZREVRANGE tags 0 4 withscores
 1) "python"
 2) "3"
 3) "rust"
 4) "2"
 5) "software"
 6) "1"
 7) "redis"
 8) "1"
 9) "memcache"
10) "1"
1
```

## Python demo

We will use the [redis-py](https://github.com/andymccurdy/redis-py) package to talk to redis and perform the above operations. The Python client looks as follows:

```
import redis
r = redis.StrictRedis(host='localhost', port=6379, db=0)

tags_scores = {
    'rust': 2,
    'python': 3,
    'golang': 1,
    'redis': 1,
    'docker': 1,
    'linux': 1,
    'software': 1,
    'c': 1,
    'memcache': 1,
    'flask': 1,
}
    

# Add the keys with scores     
for tag, score in tags_scores.items():
    r.zadd('tags', score, tag)

# Retrieve the top 5 keys
for key, score in r.zrevrange('tags', 0, 4, 'withscores'):
    print(key, score)
```


Running the above ([How?](https://github.com/amitsaha/python-redis-demo)) will give us the output:

```
b'python' 3.0
b'rust' 2.0
b'software' 1.0
b'redis' 1.0
b'memcache' 1.0
```

Note above how the syntax for the Python wrappers  are almost the same as the corresponding redis CLI command.

## Golang demo

We will use the [go-redis](https://github.com/go-redis/redis) package to interact with redis. The following program shows
how we can achieve the above in Go:

```
package main

import (
	"log"

	"github.com/go-redis/redis"
)

func main() {
	client := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	tags := map[string]float64{
		"python":   3,
		"memcache": 1,
		"rust":     2,
		"c":        1,
		"redis":    1,
		"software": 1,
		"docker":   1,
		"go":       1,
		"linux":    1,
		"flask":    1,
	}

	for tag, score := range tags {
		_, err := client.ZAdd("tags", redis.Z{score, tag}).Result()
		if err != nil {
			log.Fatalf("Error adding %s", tag)
		}
	}

	result, err := client.ZRevRangeWithScores("tags", 0, 4).Result()
	if err != nil {
		log.Fatalf("Error retrieving top 5 keys: %v", err)
	}
	for _, zItem := range result {
		log.Printf("%v\n", zItem)
	}
}
```
When we run the program after having done the necessary [setup](https://github.com/amitsaha/golang-redis-demo), we will
see the following output:

```
$ go run sorted_sets.go
2018/02/18 23:28:41 {3 python}
2018/02/18 23:28:41 {2 rust}
2018/02/18 23:28:41 {1 software}
2018/02/18 23:28:41 {1 redis}
2018/02/18 23:28:41 {1 memcache}

```

And that's all for this post.

## Resources

- [Redis data types](https://redis.io/topics/data-types-intro)
- [Redis quick start](https://redis.io/topics/quickstart)

