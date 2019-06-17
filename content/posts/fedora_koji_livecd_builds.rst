---
title:  Did your Fedora live cd build fail?
date: 2016-02-17
categories:
-  fedora
aliases:
- /did-your-fedora-live-cd-build-fail.html
---

*Update: Changed the Koji URL to reflect the change to livemedia*

As the `Fedora Scientific
<http://fedora-scientific.readthedocs.org/en/latest/>`__ maintainer, I
have to make sure I look into whether the nightly build is failing so
that I can look into the why. So far I have been doing that by going to the koji `url
<http://koji.fedoraproject.org/koji/tasks?state=all&view=tree&method=livemedia>`__.

But I think there is a better way - make a program do it
regularly. First, the program (a Python script):

.. code::

   from lxml import html
   import requests

   def main():
      page = requests.get('http://koji.fedoraproject.org/koji/tasks?state=all&view=tree&method=livemedia')
      tree = html.fromstring(page.content)

      a_class_failed = tree.xpath('//a[@class="taskfailed"]')
      for image in  a_class_failed:
      print image.text

   if __name__ == '__main__':
      main()

This incidentally happens to be my first scraping program and I got
the help I needed `here
<http://docs.python-guide.org/en/latest/scenarios/scrape/>`__.

If you install the ``requests`` and ``lxml`` packages and run the
script, it will print the list of failing builds.

Next step: I want to set this up regularly and send me an email. The
script is `here
<https://github.com/amitsaha/fedora_livecd_build_failed/blob/master/failing_images.py>`__.
As you can see, I have used `sendgrid <https://sendgrid.com/>`__ to
send myself the email using their  `Python library
<https://github.com/sendgrid/sendgrid-python>`__. So you will need to
get an API key to use this program. Before you can use the script,
please install the dependencies using ``pip install -r
requirements.txt`` preferably in it's own `virtualenv
<http://python-packaging-user-guide.readthedocs.org/en/develop/using-a-virtualenv/>`__.

I set this up in a cron job as follows:

.. code::

   0 8 * * * /home/asaha/.local/share/virtualenvs/koji_scraper/bin/python /home/asaha/work/koji_livecd_scraper/python/failing_images.py

You will of course have to setup the path correctly for your setup. The script will send me an email every morning at 8 as follows:

.. code::


   livecd (rawhide, Fedora-Live-Workstation-x86_64-rawhide, fedora-live-workstation-db37b44.ks)

   createLiveCD (rawhide, Fedora-Live-Workstation-x86_64-rawhide-20160216, fedora-live-workstation-db37b44.ks, x86_64)

   livecd (rawhide, Fedora-Live-Workstation-i686-rawhide, fedora-live-workstation-db37b44.ks)

   createLiveCD (rawhide, Fedora-Live-Workstation-i686-rawhide-20160216, fedora-live-workstation-db37b44.ks, i386)

   livecd (rawhide, Fedora-Live-Scientific_KDE-x86_64-rawhide, fedora-live-scientific_kde-db37b44.ks)

   createLiveCD (rawhide, Fedora-Live-Scientific_KDE-x86_64-rawhide-20160216, fedora-live-scientific_kde-db37b44.ks, x86_64)

   livecd (rawhide, Fedora-Live-Scientific_KDE-i686-rawhide, fedora-live-scientific_kde-db37b44.ks)

   createLiveCD (rawhide, Fedora-Live-Scientific_KDE-i686-rawhide-20160216, fedora-live-scientific_kde-db37b44.ks, i386)


The GitHub repository for the code is available `here <https://github.com/amitsaha/fedora_livecd_build_failed>`__.
