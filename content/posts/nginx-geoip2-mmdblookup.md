---
title:  Nginx and geoip lookup with geoip2 module
date: 2019-05-24
categories:
-  infrastructure
aliases:
- /nginx-and-geoip2.html
---

I wanted to setup Nginx logging so that it would perform GeoIP lookup on the IPv4 address in the `X-Forwarded-For` header.
Here's how I went about doing it on CentOS 7.

This [nginx module](https://github.com/leev/ngx_http_geoip2_module) integrates Maxmind GeoIP2 database with the RPMs
being available by [getpagespeed.com](https://www.getpagespeed.com/server-setup/nginx/upgrade-to-geoip2-with-nginx-on-cens-rhel-7).

Once I had installed the module, the hard part for me was how to get the data I wanted - city, timezone information and others
from nginx and the geoip2 module integration. This is where [mmdblookup](https://maxmind.github.io/libmaxminddb/mmdblookup.html)
helped tremendously.

# mmdblookup

`mmdblookup` can be used to read a MaxMind DB file for an IP address and query various information. To install:

```
# yum -y install libmaxminddb-devel
```

We need to give it a path to the DB file and the IP address and it spits out all that it finds out. For example:

```
$ mmdblookup --file /usr/share/GeoIP/GeoLite2-City.mmdb --ip 49.255.14.118 

  {
    "city": 
      {
        "geoname_id": 
          2147714 <uint32>
        "names": 
          {
            "de": 
              "Sydney" <utf8_string>
            "en": 
              "Sydney" <utf8_string>
            "es": 
              "Sídney" <utf8_string>
            "fr": 
              "Sydney" <utf8_string>
            "ja": 
              "シドニー" <utf8_string>
            "pt-BR": 
              "Sydney" <utf8_string>
            "ru": 
              "Сидней" <utf8_string>
            "zh-CN": 
              "悉尼" <utf8_string>
          }
      }
    "continent": 
      {
        "code": 
          "OC" <utf8_string>
        "geoname_id": 
          6255151 <uint32>
        "names": 
          {
            "de": 
              "Ozeanien" <utf8_string>
            "en": 
              "Oceania" <utf8_string>
            "es": 
              "Oceanía" <utf8_string>
            "fr": 
              "Océanie" <utf8_string>
            "ja": 
              "オセアニア" <utf8_string>
            "pt-BR": 
              "Oceania" <utf8_string>
            "ru": 
              "Океания" <utf8_string>
            "zh-CN": 
              "大洋洲" <utf8_string>
          }
      }
    "country": 
      {
        "geoname_id": 
          2077456 <uint32>
        "iso_code": 
          "AU" <utf8_string>
        "names": 
          {
            "de": 
              "Australien" <utf8_string>
            "en": 
              "Australia" <utf8_string>
            "es": 
              "Australia" <utf8_string>
            "fr": 
              "Australie" <utf8_string>
            "ja": 
              "オーストラリア" <utf8_string>
            "pt-BR": 
              "Austrália" <utf8_string>
            "ru": 
              "Австралия" <utf8_string>
            "zh-CN": 
              "澳大利亚" <utf8_string>
          }
      }
    "location": 
      {
        "accuracy_radius": 
          5 <uint16>
        "latitude": 
          -33.859100 <double>
        "longitude": 
          151.200200 <double>
        "time_zone": 
          "Australia/Sydney" <utf8_string>
      }
    "postal": 
      {
        "code": 
          "2000" <utf8_string>
      }
    "registered_country": 
      {
        "geoname_id": 
          2077456 <uint32>
        "iso_code": 
          "AU" <utf8_string>
        "names": 
          {
            "de": 
              "Australien" <utf8_string>
            "en": 
              "Australia" <utf8_string>
            "es": 
              "Australia" <utf8_string>
            "fr": 
              "Australie" <utf8_string>
            "ja": 
              "オーストラリア" <utf8_string>
            "pt-BR": 
              "Austrália" <utf8_string>
            "ru": 
              "Австралия" <utf8_string>
            "zh-CN": 
              "澳大利亚" <utf8_string>
          }
      }
    "subdivisions": 
      [
        {
          "geoname_id": 
            2155400 <uint32>
          "iso_code": 
            "NSW" <utf8_string>
          "names": 
            {
              "en": 
                "New South Wales" <utf8_string>
              "fr": 
                "Nouvelle-Galles du Sud" <utf8_string>
              "pt-BR": 
                "Nova Gales do Sul" <utf8_string>
              "ru": 
                "Новый Южный Уэльс" <utf8_string>
            }
        }
      ]
  }

```

Now, let's say we only wanted the name of the city in english, we would do something like this:

```
$ mmdblookup --file /usr/share/GeoIP/GeoLite2-City.mmdb --ip 49.255.14.118 city names en

"Sydney" <utf8_string>

```

If you look at the first "object" in the output above, you will see that the above three arguments, `city names en` is almost
like accessing a nested key inside a dictionary. I say almost, becomes it's not a JSON format. Anyway, this was the key thing
I needed to learn to be able to write the right things in my nginx configuration. 

# Logging the GeoIP decoded data

This is how the relevant nginx configuration for GeoIP2 lookup looked like:

```
...
http {

    geoip2 /etc/GeoLite2-Country.mmdb {
        auto_reload 5m;
        $geoip2_metadata_country_build metadata build_epoch;
        $geoip2_data_country_code default=US source=$http_x_forwarded_for country iso_code;
        $geoip2_data_country_name source=$http_x_forwarded_for country names en;
    }

    geoip2 /etc/GeoLite2-City.mmdb {
        $geoip2_data_city_name source=$http_x_forwarded_for city names en;
        $geoip2_data_time_zone source=$http_x_forwarded_for location time_zone;
    }

  ..
```
  
If you look at the two `geoip2` sections, you can see how I am feeding the value in the `http_x_forwarded_for` variable
as the source for the IP lookup. This is how I understand how the above is working with inline comments:

```
# this is similar to specfying --file /etc/GeoLite2-City.mmdb
geoip2 /etc/GeoLite2-City.mmdb {
        # This is assigning a variable $geoip2_data_city_name to the value of:
        # mmdblookup --file /etc/GeoLite2-City.mmdb --ip $http_x_forwarded_for city names en
        $geoip2_data_city_name source=$http_x_forwarded_for city names en;
        
        # This is assigning a variable $geoip2_data_time_zone to the value of:
        # mmdblookup --file /etc/GeoLite2-City.mmdb --ip $http_x_forwarded_for location time_zone
        $geoip2_data_time_zone source=$http_x_forwarded_for location time_zone;
    }
```

The explanations for the `GeoLite2-Country` DB is similar. Then later on in the nginx configuration, we log the 
value of this variables in JSON format. A complete nginx.conf is [here](https://gist.github.com/amitsaha/f43e9397e5f84903e5d1bffaf8b4b9d9#file-nginx-conf).

# Dealing with multiple IP addresses in X-Forwarded-For

What happens when your X-Forwarded-For has a list of IP addresses: `<UserIP>, <LB>, <API gateway>`? We need to extract the user ip
from this list and then perform GeoIP lookup on it. We will make use nginx's map module (thanks to this [answer](https://stackoverflow.com/a/53630597):

```
map $http_x_forwarded_for $realip {
        ~^(\d+\.\d+\.\d+\.\d+) $1;
        default $remote_addr;
}

```

We default to `$remote_addr` if we don't have any IP address in `$http_x_forwarded_for` and then update our GeoIP lookup as follows:

```
geoip2 /etc/GeoLite2-Country.mmdb {
        $geoip2_data_country_code default=US source=$realip country iso_code;
        $geoip2_data_country_name source=$realip country names en;
}
```

An updated complete nginx.conf is [here](https://gist.github.com/amitsaha/f43e9397e5f84903e5d1bffaf8b4b9d9#file-nginx-conf-multiple_x_forwarded_for).