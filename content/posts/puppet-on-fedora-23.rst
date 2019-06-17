---
title:  Standalone open source puppet setup on Fedora
date: 2015-10-01
categories:
-  fedora
aliases:
- /standalone-open-source-puppet-setup-on-fedora.html
---

My goal in this post is to show how to setup puppet in standalone mode on a Fedora 23 system. This setup will allow writing puppet modules and then you can apply them on your local system and check manually and via serverspec tests that they are doing what you intend them to be doing. Obviously, a VM would be the best test environment for this, or even a container. Let's get started.

Setup
=====

Install ``puppet``:

.. code::
  
   # dnf -y install puppet

Setup the host name:

.. code::

   # cat /etc/hostname 
   fedora-23.node

Reboot, verify:

.. code::

  # facter | grep node
  domain => node
  fqdn => fedora-23.node
  
Our First manifest
==================

Let's write our first manifest. We will place it in ``/etc/puppet/manifests``.

Upon installation, ``/etc/puppet`` looks like:

.. code::

   # tree /etc/puppet/
   /etc/puppet/
    ├── auth.conf
    ├── modules
    └── puppet.conf

We will create a ``manifests`` sub-directory:

.. code::

   # mkdir /etc/puppet/manifests

Now, we will create our first manifest ``/etc/puppet/manifests/nginx.pp``:

.. code::

   node "fedora-23.node" {
      package { "nginx":
        ensure => installed
      }
   }


Apply with ``--noop``:

.. code::

  # puppet apply nginx.pp --noop
  Notice: Compiled catalog for fedora-23.node in environment production in 0.66 seconds
  Notice: /Stage[main]/Main/Node[fedora-23.node]/Package[nginx]/ensure: current_value purged, should be present (noop)
  Notice: Node[fedora-23.node]: Would have triggered 'refresh' from 1 events
  Notice: Class[Main]: Would have triggered 'refresh' from 1 events
  Notice: Stage[main]: Would have triggered 'refresh' from 1 events
  Notice: Applied catalog in 0.26 seconds

Really apply:

.. code::

   # puppet apply nginx.pp
   Notice: Compiled catalog for fedora-23.node in environment production in 0.60 seconds
   Notice: /Stage[main]/Main/Node[fedora-23.node]/Package[nginx]/ensure: created
   Notice: Applied catalog in 5.67 seconds


.. code::
   
   # rpm -q nginx
   nginx-1.8.0-13.fc23.x86_64


Writing serverspec tests
========================

We will first install ``bundler``:

.. code::

   dnf -y install rubygem-bundler

We will put our serverspec test in ``/etc/puppet/manifests/tests``:

.. code::

   # mkdir /etc/puppet/manifests/tests
   # cd /etc/puppet/manifests/tests
   
Create a ``Gemfile``:

.. code::

   # cat Gemfile
   source 'https://rubygems.org'

   gem 'serverspec'
   gem 'rake'
   
Install the gems:

.. code::

   # bundle  install --path ./gems/
   Installing rake 10.4.2
   Installing diff-lcs 1.2.5
   Installing multi_json 1.11.2
   Installing net-ssh 2.9.2
   Installing net-scp 1.2.1
   Installing net-telnet 0.1.1
   Installing rspec-support 3.3.0
   Installing rspec-core 3.3.2
   Installing rspec-expectations 3.3.1
   Installing rspec-mocks 3.3.2
   Installing rspec 3.3.0
   Installing rspec-its 1.2.0
   Installing sfl 2.2
   Installing specinfra 2.43.10
   Installing serverspec 2.24.1
   Using bundler 1.7.8
   Your bundle is complete!
   It was installed into ./gems

Initialize the serverspec directory tree:

.. code::

   # bundle exec serverspec-init

   Select OS type:

   1) UN*X
   2) Windows

   Select number: 1

   Select a backend type:

   1) SSH
   2) Exec (local)

   Select number: 2

   + spec/
   + spec/localhost/
   + spec/localhost/sample_spec.rb
   + spec/spec_helper.rb
   + Rakefile
   + .rspec

Time to write our test in ``spec/localhost/nginx_spec.rb``:

 .. code::
 
    require 'spec_helper'
    describe package('nginx') do
        it { should be_installed }
    end

Let's run our test:

.. code::

   # bundle exec rake spec
   /usr/bin/ruby -I/etc/puppet/manifests/tests/gems/ruby/gems/rspec-core-3.3.2/lib:/etc/puppet/manifests/tests/gems   /ruby/gems/rspec-support-3.3.0/lib /etc/puppet/manifests/tests/gems/ruby/gems/rspec-core-3.3.2/exe/rspec --pattern spec/localhost/\*_spec.rb

   Package "nginx"
   should be installed

   Finished in 0.03447 seconds (files took 0.17465 seconds to load)
   1 example, 0 failures


Our first module
================

We will now write our first puppet module, we will name it ``nginx``:

.. code::

   # tree modules/nginx/
   modules/nginx/
   └── manifests
      ├── config
      │   ├── config1.pp
      │   └── config.pp
      └── init.pp
      
Create ``modules/nginx/manifests/init.pp``:

.. code::

   # modules/nginx/manifests/init.pp 

   class nginx {
      package { "nginx":
         ensure => installed
      }

      include nginx::config::config
   }

Create ``modules/nginx/manifests/config/config.pp``:

.. code::

   # modules/nginx/manifests/config/config.pp 
   class nginx::config::config{
  
   file { '/etc/nginx/nginx.conf':
       ensure  => present,
    }
    include nginx::config::config1
   }

Create ``modules/nginx/manifests/config/config1.pp``:

.. code::

  # modules/nginx/manifests/config/config1.pp 
  class nginx::config::config1{
    file { '/etc/nginx/conf.d':
       ensure  => directory,
    }  
  }

Let's write a manifest to include this module:

.. code::
   
   # cat manifests/use-nginx-module.pp 
   include nginx

Remove ``nginx`` and appy the manifest above:

.. code::

   # dnf remove nginx
   
   # puppet apply manifests/use-nginx-module.pp --noop
  Notice: Compiled catalog for fedora-23.node in environment production in 0.61 seconds
  Notice: /Stage[main]/Nginx/Package[nginx]/ensure: current_value purged, should be present (noop)
  Notice: Class[Nginx]: Would have triggered 'refresh' from 1 events
  Notice: /Stage[main]/Nginx::Config::Config/File[/etc/nginx/nginx.conf]/ensure: current_value absent, should be   present (noop)
  Notice: Class[Nginx::Config::Config]: Would have triggered 'refresh' from 1 events
  Notice: /Stage[main]/Nginx::Config::Config1/File[/etc/nginx/conf.d]/ensure: current_value absent, should be directory (noop)
  Notice: Class[Nginx::Config::Config1]: Would have triggered 'refresh' from 1 events
  Notice: Stage[main]: Would have triggered 'refresh' from 3 events
  Notice: Applied catalog in 0.24 seconds
  

And we are done.

Miscellaneous
=============

Use ``puppet parser`` to validate your manifest:

.. code::

   $ puppet parser validate nginx.pp

Print current module path:

.. code::

   $ puppet config print modulepath
   /etc/puppet/modules


Resources
=========

- https://docs.puppetlabs.com/references/latest/type.html#package
- https://www.digitalocean.com/community/tutorials/how-to-install-puppet-in-standalone-mode-on-centos-7
- http://serverspec.org/tutorial.html
- https://www.debian-administration.org/article/703/A_brief_introduction_to_server-testing_with_serverspec
- Advanced serverspec tips: http://serverspec.org/advanced_tips.html
