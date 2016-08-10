# Stdlib imports
import re
import string

# Third-party app imports
from bs4 import BeautifulSoup
import urllib2
import zlib

# Imports from app
from influencer.proxy import construct_opener


class LinkedInParser(object):

    def __init__(self, link):
        """ Start up... """
        self.link = link
        self.info = {}
        self.opener = construct_opener()
        self.opener.addheaders = [
            ('User-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36'),
            ('Accept-Language', 'en-US,en;q=0.8'),
            ('Accept-Encoding', 'gzip, deflate, sdch, br'),
            ('Accept', 'text/html'),
            ('Upgrade-Insecure-Requests', '1'),
        ]

        self.get_info()

    def load_page(self, url, data=None):
        """
        Utility function to load HTML from URLs for us with hack to continue despite 404
        """

        if data is not None:
            response = self.opener.open(url, data)
        else:
            response = self.opener.open(url)

        return ''.join(response.readlines())

        # print the url in case of infinite loop
        # print "Loading URL: %s" % url
        '''
        try:
            if data is not None:
                response = self.opener.open(url, data)
            else:
                response = self.opener.open(url)
            return ''.join(response.readlines())
        except:
            # If URL doesn't load for ANY reason, try again...
            # Quick and dirty solution for 404 returns because of network problems
            # However, this could infinite loop if there's an actual problem
            return self.load_page(url, data) '''

    def get_info(self):
        # gets all info = current jobs, previous jobs
        html = self.load_page(self.link)
        html = decompressed_data = zlib.decompress(html, 16 + zlib.MAX_WBITS)
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
                past_employers.append(job)

        self.info['past'] = past_employers

    def get_profile(self):
        return self.info
