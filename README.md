# aws-spot-price

CLI utility to list current global AWS EC2 Spot Instance prices. Requires valid AWS Access & Secret keys.

## Example

![Example](https://raw.githubusercontent.com/hoonoh/aws-spot-price/master/docs/preview.svg?sanitize=true)

## Options

### --region | -r

AWS region to fetch data from. Accepts multiple string values.
Defaults to all available AWS region which does not require opt-in.

### --family

EC2 instance families to filter. Will be translated to `--familyType` and `--size` values.
Accepts multiple string values.
Choose from: `general`, `compute`, `memory`, `storage`, `acceleratedComputing`

### --instanceType | -i

Type of EC2 instance to filter. Accepts multiple string values.
Enter valid EC2 instance type name. e.g. `-i t3.nano t3a.nano`

### <a name="familyType"></a>--familyType | -f

EC2 Family type (`c4`, `c5`, etc..). Accepts multiple string values. Requires `--size` option to be used together.
Internally, `--familyType` and `--size` option will build list of EC2 instance types.
For example, `-f c4 c5 -s large xlarge` is equivalent to `-i c4.large c5.large c4.xlarge c5.xlarge`.

### --size | -s

EC2 size (`large`, `xlarge`, etc..). Accepts multiple string values. Requires `--familyType` option to be used together.
See [`--familyType`](#familyType) section for more detail.

### --priceMax | -p

Maximum price.

### --productDescription | -d

Instance product description to filter. Accepts multiple string values.
You can use `linux` or `windows` (all in lowercase) as wildcard.

### --limit | -l

Limits list of price information items to be returned.

### --accessKeyId

Specific AWS Access Key ID. Requires `--secretAccessKey` option to be used together.

### --secretAccessKey

Specific AWS Secret Access Key. Requires `--accessKeyId` option to be used together.
