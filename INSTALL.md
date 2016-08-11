### Install

- Install gcloud-python for Google Cloud Pub/Sub
- Install celery + redis
- Proxy for LinkedIn

```
# Configure timezones (not on api server pls)
sudo dpkg-reconfigure tzdata

# NTP Synchronization
sudo apt-get update
sudo apt-get install ntp

# Swap file
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
sudo sh -c 'echo "/swapfile none swap sw 0 0" >> /etc/fstab' (at boot)

sudo apt-get update
sudo apt-get install python-pip python-dev libpq-dev

sudo pip install virtualenv

cd /var
mkdir apps
sudo chown -R `whoami`:root apps

mkdir ~/influencer
cd ~/influencer
virtualenv env
source env/bin/activate

sudo apt install libxml2-dev libxslt1-dev libldap2-dev libsasl2-dev

# Install redis
cd
sudo apt-get update
sudo apt-get install build-essential
sudo apt-get install tcl8.5
wget http://download.redis.io/releases/redis-stable.tar.gz
tar xzf redis-stable.tar.gz
cd redis-stable
make
make test
sudo make install
cd utils
sudo ./install_server.sh
sudo service redis_6379 start
sudo service redis_6379 stop
```
