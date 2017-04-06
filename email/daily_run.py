# -*- coding: utf-8 -*-
# Stdlib imports
import time

# Third-party app imports
import schedule

# Local app imports
from fetch import get_internal_emails


def run_emails():
    print 'Running daily process'
    get_internal_emails()

schedule.every().day.at("5:00").do(run_emails)

print 'Starting schedule'
run_emails()

while True:
    schedule.run_pending()
    time.sleep(1)
