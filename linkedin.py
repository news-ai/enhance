import urllib2
import re
import string
from bs4 import BeautifulSoup


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
            ('User-agent', ('Mozilla/4.0 (compatible; MSIE 6.0; '
                            'Windows NT 5.2; .NET CLR 1.1.4322)'))
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
        soup = BeautifulSoup(html, 'html.parser')
        htmlcode = soup.prettify(soup.original_encoding)
        experience = soup.find(id="experience")

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
