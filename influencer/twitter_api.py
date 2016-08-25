# Stdlib imports
import re
import string
import os

# Third-party app imports
from bs4 import BeautifulSoup
from requests.auth import HTTPProxyAuth
import requests
import zlib

SONET_TWTR_CONSUMER_KEY = os.getenv('NEWSAI_SONET_TWTR_CONSUMER_KEY', '')
SONET_TWTR_CONSUMER_SECRET = os.getenv('NEWSAI_SONET_TWTR_CONSUMER_SECRET', '')
SONET_TWTR_ACCESS_TOKEN = os.getenv('NEWSAI_SONET_TWTR_ACCESS_TOKEN', '')
SONET_TWTR_ACCESS_TOKEN_SECRET = os.getenv(
    'NEWSAI_SONET_TWTR_ACCESS_TOKEN_SECRET', '')


class TwitterParser(object):

    def __init__(self, link, depth=0):
        """ Start up... """
        self.link = link
        self.depth = depth
        self.info = {}

        # Setting the username of the twitter user
        self.username = ''
        username_split = link.split('/')[-1]
        if username_split[-1] == '/':
            self.username = username_split[-2]
        else:
            self.username = link.split('/')[-1]

        import twitter
        self.api = twitter.Api(consumer_key=SONET_TWTR_CONSUMER_KEY,
                               consumer_secret=SONET_TWTR_CONSUMER_SECRET,
                               access_token_key=SONET_TWTR_ACCESS_TOKEN,
                               access_token_secret=SONET_TWTR_ACCESS_TOKEN_SECRET)

        self.proxy_host = "proxy.crawlera.com"
        self.proxy_port = "8010"
        self.proxy_auth = HTTPProxyAuth("d3f8e7a7ef0a4745a85abe3fcedaa390", "")

        self.proxies = {
            "https": "https://{}:{}/".format(self.proxy_host, self.proxy_port)}

        # self.get_info()
        self.get_twitter_api_data()

    def get_twitter_api_data(self):
        exclude = set(string.punctuation)

        data = self.api.GetUser(screen_name=self.username)
        name = data.name
        description = data.description
        url = data.url

        split_description = description.split(' ')
        connections = []
        for word in split_description:
            if word[0] == '@':
                word = ''.join(ch for ch in word if ch not in exclude)
                connections.append(word)

        connection_twitter = []
        for connection in connections:
            connection_data = self.api.GetUser(screen_name=connection)
            information = {
                'name': connection_data.name,
                'url': connection_data.url,
                'description': connection_data.description,
            }
            connection_twitter.append(information)

        self.info = {
            'user': {
                'name': name,
                'description': description,
                'url': url
            },
            'employers': connection_twitter
        }

        return self.info

    def load_page(self, url, data=None):
        """
        Utility function to load HTML from URLs for us with hack to continue despite 404
        """

        r = requests.get(url, proxies=self.proxies, auth=self.proxy_auth,
                         verify='./crawlera-ca.crt')

        return r.text

    def get_info_from_scraping(self):
        # gets all info = current jobs, previous jobs
        html = self.load_page(self.link)
        soup = BeautifulSoup(html, 'html.parser')
        htmlcode = soup.prettify(soup.original_encoding)

        name = soup.find(class_="ProfileHeaderCard-name")

        # Description
        profile_header = soup.find(class_="ProfileHeaderCard-bio u-dir")
        if profile_header:
            description = profile_header.contents
            print 'description', description

        # URL
        url = soup.find(class_="ProfileHeaderCard-urlText u-dir")
        if url:
            url = url.find("a")
            print url.contents
