import mockConsole, { RestoreConsole } from 'jest-mock-console';
import nock from 'nock';

import { mockSTSClient, mockSTSClientRestore } from '../../test/mock-credential-endpoints';
import { consoleMockCallJoin } from '../../test/utils';
import { main } from '../cli';
import { awsCredentialsCheck, isAuthError } from './credential';

describe('credential', () => {
  describe('awsCredentialsCheck', () => {
    afterEach(() => {
      nock.cleanAll();
    });

    describe('invalid credentials', () => {
      beforeEach(() => {
        mockSTSClient({ fail: true });
      });

      afterEach(() => {
        mockSTSClientRestore();
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

    describe('valid credentials', () => {
      beforeEach(() => {
        mockSTSClient();
      });
      afterEach(() => {
        mockSTSClientRestore();
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
        mockSTSClient({ loadCredentialsFrom: 'none' });
      });

      afterEach(() => {
        mockSTSClientRestore();
      });

      it('should throw error', async () => {
        let threwError = false;
        try {
          await awsCredentialsCheck();
        } catch (error) {
          threwError = true;
          if (!isAuthError(error)) throw new Error('expected AuthError');
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
        mockSTSClient({ loadCredentialsFrom: 'none' });
        restoreConsole = mockConsole();
      });

      afterEach(() => {
        mockSTSClientRestore();
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
        mockSTSClient({ loadCredentialsFrom: 'none', fail: true });
        restoreConsole = mockConsole();
      });

      afterEach(() => {
        mockSTSClientRestore();
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
