import { spawnSync } from 'child_process';
import mockConsole, { RestoreConsole } from 'jest-mock-console';
import { resolve } from 'path';

import { mockAwsCredentials, mockAwsCredentialsClear } from '../test/mock-credential-endpoints';
import {
  mockDefaultRegionEndpoints,
  mockDefaultRegionEndpointsClear,
} from '../test/mock-ec2-endpoints';
import { consoleMockCallJoin } from '../test/utils';
import { main } from './cli';
import { ec2Info, Ec2InstanceInfo } from './constants/ec2-info';

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

    it('should return expected values with wide option', async () => {
      await main(['-w']);
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should return expected values if no matching records found', async () => {
      await main(['-f', 'c5', '-s', 'metal', '--pl', '0.0001']);
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
        '-p',
        'Linux/UNIX (Amazon VPC)',
        '-i',
        'c5.large',
        'c4.xlarge',
        '--pl',
        '0.05',
        '--raz',
        'false',
      ]);
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should return expected values with wildcard platforms', async () => {
      await main(['-r', 'us-east-1', '-l', '10', '-p', 'linux', '--raz', 'false']);
      await main(['-r', 'us-east-1', '-l', '10', '-p', 'windows', '--raz', 'false']);
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should return expected values with instance family types and sizes', async () => {
      await main(['-f', 'c5', '-s', 'large', '--raz', 'false', '-l', '20', '-p', 'linux']);
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should handle instance family option', async () => {
      await main(['--family', 'compute', '--raz', 'false', '-l', '20', '-p', 'linux']);
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should handle architecture option', async () => {
      await main(['--architectures', 'x86_64', '--raz', 'false', '-l', '20']);
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should handle architecture and platform options', async () => {
      await main([
        '--architectures',
        'x86_64',
        '--platforms',
        'windows',
        '--raz',
        'false',
        '-l',
        '20',
      ]);
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should handle architecture and familyType options resulting no matching instance types', async () => {
      await main([
        '--architectures',
        'arm64',
        '--familyType',
        'g4ad',
        '--raz',
        'false',
        '-l',
        '20',
      ]);
      expect(consoleMockCallJoin()).toMatchSnapshot();
    });

    it('should handle JSON output option', async () => {
      await main(['--json', '-r', 'us-east-1', '-l', '10', '--raz', 'false', '-p', 'linux']);
      const results = consoleMockCallJoin();
      const resultsObject = JSON.parse(results);
      expect(results).toMatchSnapshot();
      expect(Object.keys(resultsObject).length).toEqual(10);
      Object.keys(resultsObject).forEach(key => {
        expect(
          (resultsObject[key].availabilityZone as string).startsWith('us-east-1'),
        ).toBeTruthy();
      });
    });

    it('should handle missing accessKeyId', async () => {
      let caughtError = false;
      try {
        await main(['--secretAccessKey', 'rand']);
      } catch {
        caughtError = true;
      }
      expect(caughtError).toBeTruthy();
      expect(consoleMockCallJoin()).toContain('`accessKeyId` missing.');
    });

    it('should handle missing secretAccessKey', async () => {
      let caughtError = false;
      try {
        await main(['--accessKeyId', 'rand']);
      } catch {
        caughtError = true;
      }
      expect(caughtError).toBeTruthy();
      expect(consoleMockCallJoin()).toContain('`secretAccessKey` missing.');
    });

    describe('should handle no ec2 info found', () => {
      let c1MediumInfo: Ec2InstanceInfo | undefined;

      beforeAll(async () => {
        c1MediumInfo = ec2Info['c1.medium'];
        delete ec2Info['c1.medium'];
      });

      afterAll(() => {
        if (c1MediumInfo) ec2Info['c1.medium'] = c1MediumInfo;
      });

      it('should return expected values', async () => {
        await main(['--family', 'compute', '--raz', 'false', '-l', '20', '-p', 'linux', '-w']);
        expect(consoleMockCallJoin()).toMatchSnapshot();
      });
    });

    describe('ui mode', () => {
      beforeAll(() => {
        process.env.UI_INJECT = JSON.stringify([
          ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2'],
          [],
          ['c4', 'r5', 'f1'],
          ['nano', 'micro', 'small', 'medium', 'large'],
          ['Linux/UNIX', 'SUSE Linux'],
          undefined,
          undefined,
          0.5,
          10,
          false,
          false,
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
      } catch {
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
      expect(s.stdout).toMatchSnapshot();
    });
  });
});
