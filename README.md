# aws-spot-price

[![npm:latest](https://img.shields.io/npm/v/aws-spot-price/latest)](https://www.npmjs.com/package/aws-spot-price)
[![npm:next](https://img.shields.io/npm/v/aws-spot-price/next)](https://www.npmjs.com/package/aws-spot-price/v/next)

[![Build Status](https://dev.azure.com/aws-spot-price/aws-spot-price/_apis/build/status/hoonoh.aws-spot-price?branchName=master)](https://dev.azure.com/aws-spot-price/aws-spot-price/_build/latest?definitionId=1&branchName=master)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=hoonoh_aws-spot-price&metric=alert_status)](https://sonarcloud.io/dashboard?id=hoonoh_aws-spot-price)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=hoonoh_aws-spot-price&metric=coverage)](https://sonarcloud.io/component_measures?id=hoonoh_aws-spot-price&metric=coverage&view=list)
[![Greenkeeper badge](https://badges.greenkeeper.io/hoonoh/aws-spot-price.svg)](https://greenkeeper.io/)

Lists current global AWS EC2 Spot Instance prices.

Supports CLI and module usage.

## CLI

### Example

![Example](https://raw.githubusercontent.com/hoonoh/aws-spot-price/master/docs/preview.svg?sanitize=true)

### Installation

#### npm

`npm -g i aws-spot-price`

#### yarn

`yarn global add aws-spot-price`

#### run with npx

`npx aws-spot-price`

### Usage

`aws-spot-run [options]`

If no options are applied, it will fetch all recent pricing data from default regions and show top 20 cheapest instances.

#### Credentials

This CLI utility uses AWS-SDK and requires AWS Access & Secret keys. If environment variables pair `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` or `~/.aws/credentials` is available it will use it. Otherwise, you will need to supply credentials through CLI options [`--accessKeyId`](#accessKeyId) and [`--secretAccessKey`](#secretAccessKey).

#### Options

##### --ui

Start with UI mode.

##### --region | -r

AWS region to fetch data from. Accepts multiple string values.
Defaults to all available AWS region which does not require opt-in.

##### --family

EC2 instance families to filter. Will be translated to `--familyType` and `--size` values.
Accepts multiple string values.
Choose from: `general`, `compute`, `memory`, `storage`, `acceleratedComputing`

##### --instanceType | -i

Type of EC2 instance to filter. Accepts multiple string values.
Enter valid EC2 instance type name. e.g. `-i t3.nano t3a.nano`

##### --familyType | -f

EC2 Family type (`c4`, `c5`, etc..). Accepts multiple string values.

##### --size | -s

EC2 size (`large`, `xlarge`, etc..). Accepts multiple string values.

##### --priceMax | -p

Maximum price.

##### --productDescription | -d

Instance product description to filter. Accepts multiple string values.
You can use `linux` or `windows` (all in lowercase) as wildcard.

##### --limit | -l

Limits list of price information items to be returned.

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
    familyTypes: ['c3', 'c4', 'c5'],
    sizes: ['large', 'medium', 'xlarge'],
    limit: 5,
  });
  console.log(JSON.stringify(results, null, 2));
})();
```

#### Results

```json
[
  {
    "AvailabilityZone": "us-east-2a",
    "InstanceType": "c4.large",
    "ProductDescription": "Linux/UNIX",
    "SpotPrice": "0.018100",
    "Timestamp": "2019-11-05T03:07:19.000Z"
  },
  {
    "AvailabilityZone": "us-east-2c",
    "InstanceType": "c4.large",
    "ProductDescription": "Linux/UNIX",
    "SpotPrice": "0.018100",
    "Timestamp": "2019-11-05T03:07:19.000Z"
  },
  {
    "AvailabilityZone": "us-east-2a",
    "InstanceType": "c5.large",
    "ProductDescription": "Linux/UNIX",
    "SpotPrice": "0.019000",
    "Timestamp": "2019-11-04T14:51:42.000Z"
  },
  {
    "AvailabilityZone": "us-east-2c",
    "InstanceType": "c5.large",
    "ProductDescription": "Linux/UNIX",
    "SpotPrice": "0.019000",
    "Timestamp": "2019-11-04T14:51:42.000Z"
  },
  {
    "AvailabilityZone": "us-east-2b",
    "InstanceType": "c5.large",
    "ProductDescription": "Linux/UNIX",
    "SpotPrice": "0.019300",
    "Timestamp": "2019-11-04T14:51:42.000Z"
  }
]
```
