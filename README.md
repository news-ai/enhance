# influencer

Syncing influencer data with social network data

To start `dev_appserver.py .`

Or at the bottom put:

```python
def main():
    from paste import httpserver
    httpserver.serve(app, host='127.0.0.1', port='8080')

if __name__ == '__main__':
    main()
```

And run `service.py`.
