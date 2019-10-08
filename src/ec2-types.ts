/* eslint-disable import/no-extraneous-dependencies */
import * as cheerio from 'cheerio';
import * as needle from 'needle';

const getEc2Types = async () => {
  const data = await needle('get', 'https://aws.amazon.com/ec2/instance-types/');
  const $ = cheerio.load(data.body);

  const allInstances: string[] = [];
  $('.lb-content-wrapper tr>td:nth-child(1)').each((idx, element) => {
    let t = $(element)
      .text()
      .trim();
    if (t && t !== 'Instance' && !t.endsWith('VMs')) {
      t = t.replace(/\*/g, ''); // replace * sign
      t = t.replace(/24.xlarge/g, '24xlarge'); // seems to be typo
      allInstances.push(t);
    }
  });

  const instanceFamilies: string[] = [];
  const instanceSizes: string[] = [];

  allInstances.forEach(instanceType => {
    const [type, size] = instanceType.split('.');
    if (!type || !size || instanceType.split('.').length !== 2) {
      console.log('found some exceptions:', instanceType);
    }
    if (instanceFamilies.indexOf(type) < 0) instanceFamilies.push(type);
    if (instanceSizes.indexOf(size) < 0) instanceSizes.push(size);
  });

  // console.log(list);
  console.log(`export const instanceFamilies = [ '${instanceFamilies.sort().join("', '")}' ];`);
  console.log(`export const instanceSizes = [ '${instanceSizes.sort().join("', '")}' ];`);
  console.log(`export const allInstances = [ '${allInstances.sort().join("', '")}' ];`);
};

getEc2Types();
