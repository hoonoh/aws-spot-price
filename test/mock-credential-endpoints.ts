import {
  GetCallerIdentityCommand,
  GetCallerIdentityCommandOutput,
  STSClient,
  STSServiceException,
} from '@aws-sdk/client-sts';
import { mockClient } from 'aws-sdk-client-mock';
import mockFs from 'mock-fs';
import { homedir } from 'os';
import { resolve } from 'path';

let readFileSyncMock: jest.SpyInstance | undefined;
let stsMock: ReturnType<typeof mockClient> | undefined;

export const mockAwsCredentials = (options: { fail?: boolean; disableEnv?: boolean } = {}) => {
  const { fail, disableEnv } = options;

  mockFs({
    [`${homedir}/.aws`]: {},
    [resolve(__dirname, '../test')]: mockFs.load(resolve(__dirname, '../test'), {
      recursive: true,
    }),
  });

  if (!disableEnv) {
    process.env.AWS_ACCESS_KEY_ID = 'accessKeyId';
    process.env.AWS_SECRET_ACCESS_KEY = 'secretAccessKey';
  }

  stsMock = mockClient(STSClient)
    .on(GetCallerIdentityCommand)
    .callsFake(async () => {
      if (fail) {
        throw new STSServiceException({
          $fault: 'client',
          $metadata: {},
          name: 'MissingAuthenticationToken',
        });
      }
      const rtn: GetCallerIdentityCommandOutput = {
        $metadata: { requestId: '01234567-89ab-cdef-0123-456789abcdef' },
        Account: '123456789012',
        Arn: 'arn:aws:iam::123456789012:user/Alice',
        UserId: 'EXAMPLE',
      };
      return rtn;
    });
};

export const mockAwsCredentialsClear = (): void => {
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  readFileSyncMock?.mockRestore();
  stsMock?.restore();
  mockFs.restore();
};
