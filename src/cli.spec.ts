import { spawnSync } from 'child_process';
import { resolve } from 'path';

import mockConsole, { RestoreConsole } from 'jest-mock-console';

import { mockAwsCredentials, mockAwsCredentialsClear } from '../test/mock-credential-endpoints';
import {
  mockDefaultRegionEndpoints,
  mockDefaultRegionEndpointsClear,
} from '../test/mock-ec2-endpoints';
import { consoleMockCallJoin } from '../test/utils';
import { main } from './cli';

describe('cli', () => {
  describe('test by import', () => {
    let restoreConsole: RestoreConsole;

    beforeAll(() => {
      mockDefaultRegionEndpoints();
    });

    afterAll(() => {
      mockDefaultRegionEndpointsClear();
    });

    beforeEach(() => {
      restoreConsole = mockConsole();
    });

    afterEach(() => {
      restoreConsole();
    });

    it('should print help', async () => {
      await main(['--help']);
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should return expected values with default options', async () => {
      await main();
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should return expected values with user options', async () => {
      await main([
        '-r',
        'us-east-1',
        '-l',
        '10',
        '-l',
        '11',
        '-d',
        'Linux/UNIX (Amazon VPC)',
        '-i',
        'c5.large',
        'c4.xlarge',
        '-p',
        '0.05',
      ]);
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should return expected values with wildcard product descriptions', async () => {
      await main(['-r', 'us-east-1', '-l', '10', '-d', 'linux']);
      await main(['-r', 'us-east-1', '-l', '10', '-d', 'windows']);
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should return expected values with instance family types and sizes', async () => {
      await main(['-f', 'c5', '-s', 'large']);
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should handle instance family option', async () => {
      await main(['--family', 'compute']);
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should handle JSON output option', async () => {
      await main(['--json', '-r', 'us-east-1', '-l', '10']);
      const results = consoleMockCallJoin();
      const resultsObject = JSON.parse(results);
      expect(results).toMatchSnapshot();
      expect(Object.keys(resultsObject).length).toEqual(10);
      Object.keys(resultsObject).forEach(key => {
        expect(
          (resultsObject[key].AvailabilityZone as string).startsWith('us-east-1'),
        ).toBeTruthy();
      });
    });

    it('should handle missing accessKeyId', async () => {
      let caughtError = false;
      try {
        await main(['--secretAccessKey', 'rand']);
      } catch (error) {
        caughtError = true;
      }
      expect(caughtError).toBeTruthy();
      expect(consoleMockCallJoin()).toContain('`accessKeyId` missing.');
    });

    it('should handle missing secretAccessKey', async () => {
      let caughtError = false;
      try {
        await main(['--accessKeyId', 'rand']);
      } catch (error) {
        caughtError = true;
      }
      expect(caughtError).toBeTruthy();
      expect(consoleMockCallJoin()).toContain('`secretAccessKey` missing.');
    });

    describe('ui mode', () => {
      beforeAll(() => {
        process.env.UI_INJECT = JSON.stringify([
          ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2'],
          [],
          ['c4', 'r5', 'f1'],
          ['nano', 'micro', 'small', 'medium', 'large'],
          ['Linux/UNIX', 'SUSE Linux'],
          0.5,
          10,
        ]);
      });

      afterAll(() => {
        delete process.env.UI_INJECT;
      });

      it('should return expected result', async () => {
        await main(['--ui']);
        expect(consoleMockCallJoin()).toMatchSnapshot();
      });
    });
  });

  describe('should handle invalid credentials error', () => {
    let restoreConsole: RestoreConsole;

    beforeAll(() => {
      mockAwsCredentials({ fail: true });
      restoreConsole = mockConsole();
    });

    afterAll(() => {
      mockAwsCredentialsClear();
      restoreConsole();
    });

    it('should throw error', async () => {
      let caughtError = false;
      try {
        await main(['--accessKeyId', 'rand', '--secretAccessKey', 'rand']);
      } catch (error) {
        caughtError = true;
      }
      expect(caughtError).toBeTruthy();
      expect(consoleMockCallJoin()).toEqual('Invalid AWS credentials provided.');
    });
  });

  describe('test by spawnSync', () => {
    const cliJsPath = resolve(__dirname, '../dist/cli.js');
    it('should stdout help screen', () => {
      const s = spawnSync('node', [cliJsPath, '--help'], { encoding: 'utf-8' });
      console.log(s.stdout);
      expect(s.stdout).toMatchSnapshot();
    });
  });
});
