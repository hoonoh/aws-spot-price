import fs from 'fs';
import { sep } from 'path';

import { config } from 'aws-sdk';
import nock from 'nock';

let readFileSyncMock: jest.SpyInstance;

export const mockAwsCredentials = (
  options: { fail?: boolean; disableEnv?: boolean } = {},
): void => {
  const { fail, disableEnv } = options;

  config.credentials = null;

  const mock = (): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readFileSyncMock = jest.spyOn(fs, 'readFileSync').mockImplementation((...args: any) => {
      const path = args[0] as string;
      if (!path.includes(`${sep}.aws${sep}`)) {
        readFileSyncMock.mockRestore();
        const rtn = fs.readFileSync(args[0], args[1]);
        mock();
        return rtn;
      }
      return Buffer.from('');
    });
  };
  mock();

  if (!disableEnv) {
    process.env.AWS_ACCESS_KEY_ID = 'accessKeyId';
    process.env.AWS_SECRET_ACCESS_KEY = 'secretAccessKey';
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
  if (readFileSyncMock) readFileSyncMock.mockRestore();
  nock.cleanAll();
};
