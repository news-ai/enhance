# Stdlib imports
import collections
import datetime
import json

# Third-party app imports
from gcloud import datastore
import requests

# Imports from app
from influencer.linkedin import LinkedInParser
from influencer.twitter_api import TwitterParser
from taskrunner import app

client = datastore.Client('newsai-1166')


def find_or_create_publisher(publisher_name, publication_url):
    # Try get the publication
    query = client.query(kind='Publication')
    query.add_filter('Name', '=', publisher_name)
    results = list(query.fetch())
    if len(results) > 0:
        result = results[0]
        return result.key.id

    # Otherwise add it
    incomplete_key = client.key('Publication')
    new_publication = datastore.Entity(key=incomplete_key)
    if isinstance(publisher_name, str):
        publisher_name = unicode(publisher_name, 'utf-8')
    if isinstance(publication_url, str):
        publication_url = unicode(publication_url, 'utf-8')
    current_time = datetime.datetime.utcnow()

    new_publication.update({
        'Name': publisher_name,
        'Url': publication_url,
        'Created': current_time,
        'Updated': current_time,
        'CreatedBy': 0
    })
    client.put(new_publication)

    # Return key
    return new_publication.key.id


def update_datastore(data, contact_id, is_linkedin):
    key = client.key('Contact', int(contact_id))
    result = client.get(key)

    post_data = {}
    post_data['employers'] = []
    post_data['pastemployers'] = []

    past_employers = {}

    if not is_linkedin:
        if 'Employers' in result:
            post_data['employers'] = result['Employers']
        if 'PastEmployers' in result:
            post_data['pastemployers'] = result['PastEmployers']

    # Current jobs
    if data['current']:
        for job in data['current']:
            employer_id = find_or_create_publisher(job['employer'], job['url'])
            post_data['employers'].append(employer_id)

    # Past jobs
    if data['past']:
        for job in data['past']:
            employer_id = find_or_create_publisher(job['employer'], job['url'])
            post_data['pastemployers'].append(employer_id)

    # Small data cleanup
    if len(post_data['employers']) > 0:
        post_data['employers'] = [item for item, count in collections.Counter(
            post_data['employers']).items() if count >= 1]
    if len(post_data['pastemployers']) > 0:
        post_data['pastemployers'] = [item for item, count in collections.Counter(
            post_data['pastemployers']).items() if count >= 1]

        for pastemployer in post_data['pastemployers']:
            past_employers[str(pastemployer)] = True

    # If they have more than one main job remove jobs that exist both in past
    # employers and employers.
    if len(post_data['employers']) > 1:
        for index, employee in enumerate(post_data['employers']):
            if str(employee) in past_employers:
                del post_data['employers'][index]

    # Post data
    json_data = json.dumps(post_data)
    r = requests.patch(
        'https://tabulae.newsai.org/api/contacts/' + str(contact_id), data=json_data, verify=False, auth=('jebqsdFMddjuwZpgFrRo', ''))
    if r.status_code != requests.codes.ok:
        print r.text


@app.task
def twitter_sync(twitter_url, contact_id, just_created):
    twitter_result = TwitterParser(twitter_url)
    twitter_data = twitter_result.get_twitter_api_data()

    # Both of these cases mean that the data did not load
    if not twitter_data:
        # If the data is false and they just created it
        # Then we'll try a little harder
        retry_number = 5
        if just_created:
            # Re-try five more times
            retry_number = 10
        for x in xrange(1, retry_number):
            twitter_result = TwitterParser(twitter_url)
            twitter_data = twitter_result.get_profile()
            print twitter_data
            if twitter_data:
                print twitter_data
                break

    # Lets see if it works this time!
    # If not then something is invalid
    if not twitter_data:
        return False

    # Data loaded from Linkedin
    update_datastore(twitter_data, contact_id, False)
    return True


@app.task
def linkedin_sync(linkedin_url, contact_id, just_created):
    linkedin_result = LinkedInParser(linkedin_url)
    linkedin_data = linkedin_result.get_profile()

    # Both of these cases mean that the data did not load
    if not linkedin_data:
        # If the data is false and they just created it
        # Then we'll try a little harder
        retry_number = 5
        if just_created:
            # Re-try five more times
            retry_number = 10
        for x in xrange(1, retry_number):
            linkedin_result = LinkedInParser(linkedin_url)
            linkedin_data = linkedin_result.get_profile()
            print linkedin_data
            if linkedin_data:
                print linkedin_data
                break

    # Lets see if it works this time!
    # If not then something is invalid
    if not linkedin_data:
        return False

    # Data loaded from Linkedin
    update_datastore(linkedin_data, contact_id, True)
    return True
