import twitter
import requests

from validate_email import check_email

api = twitter.Api(consumer_key='w76zxrawNruOi6yFy9CqPRrUN',
                  consumer_secret='JWf3MzbYO2VN6i0RhD7pjVcfYu7oi8wCvAUW4woarIOi8UOyvc',
                  access_token_key='15308142-xLdH5r25YNRRsWHjlcRhI6DuTYrSb8Lxcu2yHhErJ',
                  access_token_secret='6B07t0TZaxI7zR9X9Q0uEJG5noKCIARWC6wRXM6Tf6CuH')


def process_email_on_enhance(email):
    r = requests.get('http://enhance.newsai.org/fullcontact/' +
                     email, auth=('newsai', 'XkJRNRx2EGCd6'), verify=False)
    print r.status_code


def find_email_for_name(full_name, domain_extension):
    full_name_array = full_name.split(' ')
    first_name = full_name_array[0].lower()
    last_name = full_name_array[-1].lower()

    domain_extension = domain_extension.lower()

    valid_email = ''

    emails_to_test = []
    emails_to_test.append(first_name + domain_extension)
    emails_to_test.append(first_name + '.' + last_name + domain_extension)
    emails_to_test.append(first_name[0] + last_name + domain_extension)
    emails_to_test.append(first_name[0] + last_name[0] + domain_extension)
    emails_to_test.append(last_name + domain_extension)

    print emails_to_test

    for email in emails_to_test:
        email_valid = check_email(email)
        if email_valid and email_valid[0]:
            valid_email = email

    return valid_email


def get_list_members(list_id, owner_screen_name, domain_extension):
    list_members = api.GetListMembers(
        list_id=list_id, owner_screen_name=owner_screen_name)
    for list_member in list_members:
        valid_email = find_email_for_name(list_member.name, domain_extension)
        print valid_email
        if valid_email != '':
            process_email_on_enhance(valid_email)


def get_lists_by_user_name(screen_name):
    print api.GetLists(screen_name=screen_name)

# get_lists_by_user_name('usatoday')
get_list_members(1599986, 'usatoday', '@usatoday.com')
