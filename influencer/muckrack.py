# Stdlib imports
import re
import string

# Third-party app imports
from bs4 import BeautifulSoup
from requests.auth import HTTPProxyAuth
import requests
import zlib


class MuckRackParser(object):

    def __init__(self, link):
        """ Start up... """
        self.link = link
        self.info = {}

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

        return r.text

    def get_info(self):
        # gets all info = current jobs, previous jobs
        html = self.load_page(self.link)
        soup = BeautifulSoup(html, 'html.parser')
        htmlcode = soup.prettify(soup.original_encoding)

        contact_information = soup.find(class_="profile-social-icons")
        contacts = contact_information.find_all("a")

        title = soup.find(class_="person-details-title")
        titles = title.find_all("a")

        summary = soup.find(class_="profile-summary-section")
        positions = summary.find_all("a")

        for contact in contacts:
            print 'Contact information', contact['href']

        for single_title in titles:
            print 'Current position', single_title.contents[0]

        for position in positions:
            print 'Past position', position.contents[0]