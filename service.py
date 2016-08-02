#!/usr/bin/env python
# encoding: utf-8

import simplejson as json
from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
import requests

from linkedin import LinkedInParser

PORT = 1030


class InfluencerService(BaseHTTPRequestHandler):

    def do_POST(self):
        content_len = int(self.headers.getheader('content-length'))
        raw_text = self.rfile.read(content_len)
        raw_text = raw_text.decode('utf8')
        influencer_result = self.extract(raw_text)

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=UTF-8")
        self.end_headers()

        self.wfile.write(json.dumps(influencer_result.get_profile()))
        return

    def extract(self, url):
        return LinkedInParser(url)


def influencer_extract(url):
    r = requests.post("http://localhost:%d/" % (PORT), data=url,
                      headers={'content-type': 'text/plain; chartset=utf-8'})
    if r.status_code != requests.codes.ok:
        r.raise_for_status()

    print r.text

    return json.loads(r.text)


def main():
    server = HTTPServer(('', PORT), InfluencerService)
    server.serve_forever()

if __name__ == "__main__":
    main()
