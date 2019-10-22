import { config } from 'aws-sdk';
import * as nock from 'nock';

export const mockAwsCredentials = (
  options: { fail?: boolean; disableEnv?: boolean; disableConfig?: boolean } = {},
): void => {
  const { fail, disableEnv, disableConfig } = options;

  if (!disableEnv) {
    process.env.AWS_ACCESS_KEY_ID = 'accessKeyId';
    process.env.AWS_SECRET_ACCESS_KEY = 'secretAccessKey';
  }

  if (!disableConfig) {
    config.accessKeyId = 'accessKeyId';
    config.secretAccessKey = 'secretAccessKey';
  }

  if (fail) {
    nock('https://sts.amazonaws.com')
      .persist()
      .post('/')
      .reply(
        403,
        `<ErrorResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
          <Error>
            <Type>Sender</Type>
            <Code>MissingAuthenticationToken</Code>
            <Message>Request is missing Authentication Token</Message>
          </Error>
          <RequestId>4fc0d3ee-efef-11e9-9282-3b7bffe54a9b</RequestId>
        </ErrorResponse>`,
      );
  } else {
    nock(`https://sts.amazonaws.com`)
      .persist()
      .post('/')
      .reply(
        200,
        `<GetCallerIdentityResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
          <GetCallerIdentityResult>
          <Arn>arn:aws:iam::123456789012:user/Alice</Arn>
            <UserId>EXAMPLE</UserId>
            <Account>123456789012</Account>
          </GetCallerIdentityResult>
          <ResponseMetadata>
            <RequestId>01234567-89ab-cdef-0123-456789abcdef</RequestId>
          </ResponseMetadata>
        </GetCallerIdentityResponse>`,
      );
  }
};

export const mockAwsCredentialsClear = (): void => {
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete config.accessKeyId;
  delete config.secretAccessKey;
};
