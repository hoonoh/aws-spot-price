# aws-spot-price

[![npm:latest](https://img.shields.io/npm/v/aws-spot-price/latest)](https://www.npmjs.com/package/aws-spot-price)

[![Build Status](https://github.com/hoonoh/aws-spot-price/actions/workflows/pull-request.yml/badge.svg)](https://github.com/hoonoh/aws-spot-price/actions/workflows/pull-request.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=hoonoh_aws-spot-price&metric=alert_status)](https://sonarcloud.io/dashboard?id=hoonoh_aws-spot-price)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=hoonoh_aws-spot-price&metric=coverage)](https://sonarcloud.io/component_measures?id=hoonoh_aws-spot-price&metric=coverage&view=list)

Lists current global AWS EC2 Spot Instance prices.

Supports CLI and module usage.

## CLI

### Example

![Example](https://raw.githubusercontent.com/hoonoh/aws-spot-price/master/docs/preview.gif?sanitize=true)

### Installation

#### npm

`npm i aws-spot-price`

#### yarn

`yarn add aws-spot-price`

#### run with npx

`npx aws-spot-price`

#### run with yarn dlx

`yarn dlx aws-spot-price`

### Usage

`aws-spot-run [options]`

If no options are applied, it will fetch all recent pricing data from default regions and show top 30 cheapest instances.

#### Credentials

This CLI utility uses AWS-SDK and requires AWS Access & Secret keys. If environment variables pair `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` or `~/.aws/credentials` is available it will use it. Otherwise, you will need to supply credentials through CLI options [`--accessKeyId`](#accessKeyId) and [`--secretAccessKey`](#secretAccessKey).

##### Permissions Required

- ec2:DescribeSpotPriceHistory
- ec2:DescribeInstanceTypes

#### Options

##### --ui

Start with UI mode.

##### --region | -r

AWS region to fetch data from. Accepts multiple string values.
Defaults to all available AWS region which does not require opt-in.

###### _example `-r us-east-1 us-east-2`_

##### --family

EC2 instance families to filter. Will be translated to `--familyType` and `--size` values.
Accepts multiple string values.
Choose from: `general`, `compute`, `memory`, `storage`, `acceleratedComputing`

###### _example `-f general compute`_

##### --instanceType | -i

Type of EC2 instance to filter. Accepts multiple string values.
Enter valid EC2 instance type name.

###### _example `-i t3.nano t3a.nano`_

##### --familyType | -f

EC2 Family type (`c4`, `c5`, etc..). Accepts multiple string values.

###### _example `-f c4 c5`_

##### --size | -s

EC2 size (`large`, `xlarge`, etc..). Accepts multiple string values.

###### _example `-s large xlarge`_

##### --minVCPU | --mc

Minimum vCPU count

###### _Default: 1_

##### --minMemoryGiB | --mm

Minimum memory size in GiB

###### _Default: 0.5_

##### --priceLimit | --pl

Maximum price limit.

###### _Default: 100_

##### --platforms | -p

Instance platforms types to filter. Accepts multiple string values.
You can use `linux` or `windows` (all in lowercase) as wildcard.

###### _Default: "Linux/UNIX" "Linux/UNIX (Amazon VPC)"_

###### _example `-p windows "Red Hat Enterprise Linux"`_

##### --limit | -l

Limits list of price information items to be returned.

###### _Default: 30_

##### --reduceAZ | --raz

Reduce results with cheapest Availability Zone within Region

###### _Default: true_

##### --wide | -w

Output results with detail (vCPU, memory, etc)

###### _Default: false_

##### --json | -j

Outputs in JSON format. This option will silence any progress output.

##### <a name="accessKeyId"></a>--accessKeyId

Specific AWS Access Key ID. Requires `--secretAccessKey` option to be used together.

##### <a name="secretAccessKey"></a>--secretAccessKey

Specific AWS Secret Access Key. Requires `--accessKeyId` option to be used together.

## Module

### Installation

#### npm

`npm i aws-spot-price`

#### yarn

`yarn add aws-spot-price`

### Example

#### Code

```javascript
import { getGlobalSpotPrices } from 'aws-spot-price';

(async () => {
  const results = await getGlobalSpotPrices({
    regions: ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2'],
    familyTypes: ['c5', 'c5a', 'c5ad', 'c5d', 'c5n', 'c6g', 'c6gd'],
    minMemoryGiB: 4,
    minVCPU: 2,
    limit: 5,
    reduceAZ: true,
  });
  console.log(JSON.stringify(results, null, 2));
})();
```

#### Results

```json[
  {
    "availabilityZone": "us-east-2c",
    "instanceType": "c5.large",
    "platform": "Linux/UNIX",
    "spotPrice": 0.019,
    "timestamp": "2020-11-19T15:18:07.000Z",
    "vCpu": 2,
    "memoryGiB": 4
  },
  {
    "availabilityZone": "us-east-2c",
    "instanceType": "c5a.large",
    "platform": "Linux/UNIX",
    "spotPrice": 0.019,
    "timestamp": "2020-11-19T22:04:26.000Z",
    "vCpu": 2,
    "memoryGiB": 4
  },
  {
    "availabilityZone": "us-east-2a",
    "instanceType": "c5d.large",
    "platform": "Linux/UNIX",
    "spotPrice": 0.019,
    "timestamp": "2020-11-19T05:58:45.000Z",
    "vCpu": 2,
    "memoryGiB": 4
  },
  {
    "availabilityZone": "us-east-2a",
    "instanceType": "c5n.large",
    "platform": "Linux/UNIX",
    "spotPrice": 0.019,
    "timestamp": "2020-11-20T02:27:24.000Z",
    "vCpu": 2,
    "memoryGiB": 5.25
  },
  {
    "availabilityZone": "us-east-2b",
    "instanceType": "c6g.large",
    "platform": "Linux/UNIX",
    "spotPrice": 0.02,
    "timestamp": "2020-11-19T13:41:03.000Z",
    "vCpu": 2,
    "memoryGiB": 4
  }
]
```
