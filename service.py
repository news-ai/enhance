#!/usr/bin/env python
# encoding: utf-8

import webapp2
import json

import requests

from linkedin import LinkedInParser

PORT = 1030


class InfluencerService(webapp2.RequestHandler):

    def post(self):
        jsonobject = json.loads(self.request.body)
        influencer_result = self.extract(jsonobject["url"])

        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(influencer_result.get_profile()))

    def extract(self, url):
        return LinkedInParser(url)


app = webapp2.WSGIApplication([
    ('/', InfluencerService),
], debug=True)


def main():
    from paste import httpserver
    httpserver.serve(app, host='0.0.0.0', port='8080')

if __name__ == '__main__':
    main()
