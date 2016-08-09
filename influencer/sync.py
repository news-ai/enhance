# Imports from app
from influencer.linkedin import LinkedInParser
from taskrunner import app


@app.task
def linkedin_sync(linkedin_url, contact_url):
    linkedin_result = LinkedInParser(linkedin_url)
    print linkedin_result.get_profile()
