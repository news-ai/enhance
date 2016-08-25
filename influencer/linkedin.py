# Stdlib imports
import re
import string

# Third-party app imports
from bs4 import BeautifulSoup
from requests.auth import HTTPProxyAuth
import urllib2
import requests
import zlib


class LinkedInParser(object):

    def __init__(self, link):
        """ Start up... """
        self.link = link
        self.info = {}

        self.opener = urllib2.build_opener(
            urllib2.HTTPRedirectHandler(),
            urllib2.HTTPHandler(debuglevel=0),
            urllib2.HTTPSHandler(debuglevel=0),
        )
        self.opener.addheaders = [
            ('User-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36'),
            ('Accept-Language', 'en-US,en;q=0.8'),
            ('Accept', 'text/html'),
            ('Upgrade-Insecure-Requests', '1'),
        ]

        self.proxy_host = "proxy.crawlera.com"
        self.proxy_port = "8010"
        self.proxy_auth = HTTPProxyAuth("d3f8e7a7ef0a4745a85abe3fcedaa390", "")

        self.proxies = {
            "https": "https://{}:{}/".format(self.proxy_host, self.proxy_port)}

        self.get_info()

    def load_page(self, url, data=None):
        """
        Utility function to load HTML from URLs for us with hack to continue despite 404
        """

        r = requests.get(url, proxies=self.proxies, auth=self.proxy_auth,
                         verify='./crawlera-ca.crt')

        if r.status_code == 523:
            print 'Alternative'
            response = self.opener.open(url)
            return ''.join(response.readlines())
        return r.text

    def get_info(self):
        # gets all info = current jobs, previous jobs
        html = self.load_page(self.link)
        soup = BeautifulSoup(html, 'html.parser')
        htmlcode = soup.prettify(soup.original_encoding)
        experience = soup.find(id="experience")

        if experience is None:
            return False

        # gets current job
        current_jobs = []
        for i in experience.find_all(class_="position"):
            if i['data-section'] == 'currentPositionsDetails':
                job = {}
                job['position'] = i.find(class_="item-title").text
                job['employer'] = i.find(class_="item-subtitle").text
                job['date'] = i.find(class_="date-range").text
                job['url'] = ''
                current_jobs.append(job)

        self.info['current'] = current_jobs

        # gets previous job
        past_employers = []
        for i in experience.find_all(class_="position"):
            if i['data-section'] == 'pastPositionsDetails':
                job = {}
                job['position'] = i.find(class_="item-title").text
                job['employer'] = i.find(class_="item-subtitle").text
                job['date'] = i.find(class_="date-range").text
                job['url'] = ''
                past_employers.append(job)

        self.info['past'] = past_employers

    def get_profile(self):
        return self.info
