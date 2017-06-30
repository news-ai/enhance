# -*- coding: utf-8 -*-
# Stdlib imports
import urllib3
import os
import re
import json
from datetime import datetime, timedelta

# Third-party app imports
import requests
import certifi
from requests.packages.urllib3.exceptions import InsecureRequestWarning
from elasticsearch import Elasticsearch, helpers

# Internal
from validate import check_email

# Elasticsearch
ELASTICSEARCH_USER = os.environ['NEWSAI_ELASTICSEARCH_USER']
ELASTICSEARCH_PASSWORD = os.environ['NEWSAI_ELASTICSEARCH_PASSWORD']

# Removing requests warning
urllib3.disable_warnings()
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

# Elasticsearch setup
es = Elasticsearch(
    ['https://search.newsai.org'],
    http_auth=(ELASTICSEARCH_USER, ELASTICSEARCH_PASSWORD),
    port=443,
    use_ssl=True,
    verify_certs=True,
    ca_certs=certifi.where(),
)


def get_internal_emails():
    page = es.search(
        index='database',
        doc_type='internal1',
        scroll='2m',
        search_type='scan',
        size=1,
        body={}
    )

    sid = page['_scroll_id']
    scroll_size = page['hits']['total']

    while (scroll_size > 0):
        page = es.scroll(scroll_id=sid, scroll='2m')
        sid = page['_scroll_id']
        scroll_size = len(page['hits']['hits'])
        print "scroll size: " + str(scroll_size)

        to_append = []

        for email in page['hits']['hits']:
            email_address = email['_source']['data']['email']
            print email_address.encode('utf-8')
            email_valid = check_email(email_address)
            print email_valid

            if len(email_valid) > 0:
                email['_source']['data']['valid'] = email_valid[0]
                email['_source']['data']['reason'] = email_valid[1]

                doc = {
                    '_type': 'internal1',
                    '_index': 'database',
                    '_id': email_address,
                    'data': email['_source']['data']
                }

                to_append.append(doc)

        res = helpers.bulk(es, to_append)
        print res
