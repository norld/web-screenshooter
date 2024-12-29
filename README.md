# web-screenshooter

web-screenshooter is a service that allows you to take screenshots of websites using only a link and store the captured images in AWS S3.

## Environment Variables

To run this project, you will need to add the following environment variables to your `.env` file:

```
BASE_API=endpoint to store screenshot
BEARER_TOKEN=infinity expired token for security
```

## How to Run

To run the web-screenshooter service, follow these steps:

1. Clone the repository:
  ```sh
  git clone https://github.com/norld/web-screenshooter.git
  ```

2. Navigate to the project directory:
  ```sh
  cd web-screenshooter
  ```

3. Install the dependencies:
  ```sh
  npm install
  ```

4. Create a `.env` file in the root directory and add the required environment variables as mentioned above.

5. Start the service:
  ```sh
  npm start
  ```

The service should now be running, and you can start taking screenshots by making requests to the API.