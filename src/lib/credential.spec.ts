import assert from 'assert';
import mockConsole, { RestoreConsole } from 'jest-mock-console';

import { mockAwsCredentials, mockAwsCredentialsClear } from '../../test/mock-credential-endpoints';
import { consoleMockCallJoin } from '../../test/utils';
import { main } from '../cli';
import { AuthError, awsCredentialsCheck } from './credential';

describe('credential', () => {
  describe('awsCredentialsCheck', () => {
    describe('should throw error', () => {
      beforeEach(() => {
        mockAwsCredentials({ fail: true });
      });

      afterEach(() => {
        mockAwsCredentialsClear();
      });

      it('should throw error', async () => {
        let threwError = false;
        try {
          await awsCredentialsCheck();
        } catch (error) {
          threwError = true;
        }
        expect(threwError).toBeTruthy();
      });
    });

    describe('should not throw error', () => {
      beforeEach(() => {
        mockAwsCredentials();
      });
      afterEach(() => {
        mockAwsCredentialsClear();
      });
      it('should not throw error', async () => {
        let threwError = false;
        try {
          await awsCredentialsCheck();
        } catch (error) {
          threwError = true;
        }
        expect(threwError).toBeFalsy();
      });
    });

    describe('should handle credentials unavailable', () => {
      beforeEach(() => {
        mockAwsCredentials({ disableEnv: true });
      });

      afterEach(() => {
        mockAwsCredentialsClear();
      });

      it('should handle credentials unavailable', async () => {
        let threwError = false;
        try {
          await awsCredentialsCheck();
        } catch (error) {
          threwError = true;
          expect(error instanceof AuthError).toBeTruthy();
          assert(error instanceof AuthError);
          expect(error.message).toEqual('AWS credentials unavailable.');
          expect(error.code).toEqual('CredentialsNotFound');
        }
        expect(threwError).toBeTruthy();
      });
    });
  });

  describe('cli credential', () => {
    let restoreConsole: RestoreConsole;

    describe('handle no credential found', () => {
      beforeEach(() => {
        mockAwsCredentials({ disableEnv: true });
        restoreConsole = mockConsole();
      });

      afterEach(() => {
        mockAwsCredentialsClear();
        restoreConsole();
      });

      it('should print no credential found', async () => {
        let threwError = false;
        try {
          await main();
        } catch (error) {
          threwError = true;
          expect(consoleMockCallJoin()).toContain('AWS credentials are not found.');
        }
        expect(threwError).toBeTruthy();
      });
    });

    describe('handle invalid credentials', () => {
      beforeEach(() => {
        mockAwsCredentials({ disableEnv: true, fail: true });
        restoreConsole = mockConsole();
      });

      afterEach(() => {
        mockAwsCredentialsClear();
        restoreConsole();
      });

      it('should print invalid credential', async () => {
        let threwError = false;
        try {
          await main(['--accessKeyId', 'temp', '--secretAccessKey', 'temp2']);
        } catch (error) {
          threwError = true;
          expect(consoleMockCallJoin()).toContain('Invalid AWS credentials provided.');
        }
        expect(threwError).toBeTruthy();
      });
    });
  });
});
