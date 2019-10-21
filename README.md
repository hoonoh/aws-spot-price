<a href="https://npmjs.org/package/aws-spot-price">
  <img src="https://img.shields.io/npm/v/aws-spot-price.svg" alt="version" />
</a>

# aws-spot-price

CLI utility to list current global AWS EC2 Spot Instance prices. Requires valid AWS Access & Secret keys.

## Example

![Example](https://raw.githubusercontent.com/hoonoh/aws-spot-price/master/docs/preview.svg?sanitize=true)

## Installation

### npm

`npm -g i aws-spot-price`

### yarn

`yarn global add aws-spot-price`

### run with npx

`npx aws-spot-price`

## Usage

`aws-spot-run [options]`

If no options are applied, it will fetch all recent pricing data from default regions and show top 20 cheapest instances.

### Credentials

This CLI utility uses AWS-SDK and requires AWS Access & Secret keys. If environment variables pair `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` or `~/.aws/credentials` is available it will use it. Otherwise, you will need to supply credentials through CLI options [`--accessKeyId`](#accessKeyId) and [`--secretAccessKey`](#secretAccessKey).

### Options

#### --ui

Start with UI mode.

#### --region | -r

AWS region to fetch data from. Accepts multiple string values.
Defaults to all available AWS region which does not require opt-in.

#### --family

EC2 instance families to filter. Will be translated to `--familyType` and `--size` values.
Accepts multiple string values.
Choose from: `general`, `compute`, `memory`, `storage`, `acceleratedComputing`

#### --instanceType | -i

Type of EC2 instance to filter. Accepts multiple string values.
Enter valid EC2 instance type name. e.g. `-i t3.nano t3a.nano`

#### <a name="familyType"></a>--familyType | -f

EC2 Family type (`c4`, `c5`, etc..). Accepts multiple string values. Requires `--size` option to be used together.
Internally, `--familyType` and `--size` option will build list of EC2 instance types.
For example, `-f c4 c5 -s large xlarge` is equivalent to `-i c4.large c5.large c4.xlarge c5.xlarge`.

#### --size | -s

EC2 size (`large`, `xlarge`, etc..). Accepts multiple string values. Requires `--familyType` option to be used together.
See [`--familyType`](#familyType) section for more detail.

#### --priceMax | -p

Maximum price.

#### --productDescription | -d

Instance product description to filter. Accepts multiple string values.
You can use `linux` or `windows` (all in lowercase) as wildcard.

#### --limit | -l

Limits list of price information items to be returned.

#### <a name="accessKeyId"></a>--accessKeyId

Specific AWS Access Key ID. Requires `--secretAccessKey` option to be used together.

#### <a name="secretAccessKey"></a>--secretAccessKey

Specific AWS Secret Access Key. Requires `--accessKeyId` option to be used together.
