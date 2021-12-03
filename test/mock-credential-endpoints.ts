import {
  GetCallerIdentityCommand,
  ServiceInputTypes,
  ServiceOutputTypes,
  STSClient,
} from '@aws-sdk/client-sts';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import fs, { PathLike } from 'fs';
import { EOL } from 'os';
import { sep } from 'path';

let readFileMock: jest.SpyInstance | undefined;

let stsClientMock: AwsStub<ServiceInputTypes, ServiceOutputTypes> | undefined;

export const mockSTSClient = ({
  fail,
  loadCredentialsFrom,
}: {
  fail?: boolean;
  loadCredentialsFrom?: 'env' | 'ini' | 'none';
} = {}) => {
  if (loadCredentialsFrom === undefined) loadCredentialsFrom = 'ini';
  if (loadCredentialsFrom === 'env') {
    process.env.AWS_ACCESS_KEY_ID = 'accessKeyId';
    process.env.AWS_SECRET_ACCESS_KEY = 'secretAccessKey';
  }

  jest.mock('fs');

  // mock ~/.aws config files load
  // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/34889#issuecomment-485263490
  // https://github.com/aws/aws-sdk-js-v3/blob/1429ad1f2e631638db95d0e56eb9509c234ba146/packages/shared-ini-file-loader/src/index.ts#L102-L108
  // aws-sdk-js-v3 shared-ini-file-loader uses readFile with encoding as option
  readFileMock = jest.spyOn(fs, 'readFile').mockImplementation(((
    path: PathLike | number,
    options: { encoding?: null; flag?: string } | undefined | null | string,
    cb: (err: NodeJS.ErrnoException | null, data: string) => void,
  ) => {
    if (typeof path === 'string' && path.includes(`${sep}.aws${sep}`)) {
      if (loadCredentialsFrom === 'ini') {
        if (path.includes(`${sep}config`)) {
          // .aws/config
          return cb(
            null,
            [
              //
              '[default]',
              'region=us-east-1',
            ].join(EOL),
          );
        } else if (path.includes(`${sep}credentials`)) {
          // .aws/credentials
          return cb(
            null,
            [
              '[default]',
              'aws_access_key_id = accessKeyId',
              'aws_secret_access_key = secretAccessKey',
            ].join(EOL),
          );
        }
      } else {
        return cb(new Error(`Error: ENOENT: no such file or directory, open '${path}'`), '');
      }
    }
    return cb(null, fs.readFileSync(path).toString());
  }) as typeof fs.readFile);

  stsClientMock = mockClient(STSClient);

  if (fail) {
    stsClientMock.on(GetCallerIdentityCommand, {}).rejects();
  } else {
    stsClientMock.on(GetCallerIdentityCommand, {}).resolves({});
  }
};

export const mockSTSClientRestore = () => {
  stsClientMock?.restore();
  stsClientMock = undefined;
  readFileMock?.mockRestore();
  readFileMock = undefined;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
};
