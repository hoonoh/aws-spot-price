import { InstanceTypeInfo } from '@aws-sdk/client-ec2';

export const c1Medium: InstanceTypeInfo = {
  InstanceType: 'c1.medium',
  CurrentGeneration: false,
  FreeTierEligible: false,
  SupportedUsageClasses: ['on-demand', 'spot'],
  SupportedRootDeviceTypes: ['ebs', 'instance-store'],
  SupportedVirtualizationTypes: ['hvm', 'paravirtual'],
  BareMetal: false,
  Hypervisor: 'xen',
  ProcessorInfo: {
    SupportedArchitectures: ['i386', 'x86_64'],
  },
  VCpuInfo: {
    DefaultVCpus: 2,
    DefaultCores: 2,
    DefaultThreadsPerCore: 1,
  },
  MemoryInfo: {
    SizeInMiB: 1740,
  },
  InstanceStorageSupported: true,
  InstanceStorageInfo: {
    TotalSizeInGB: 350,
    Disks: [
      {
        SizeInGB: 350,
        Count: 1,
        Type: 'hdd',
      },
    ],
    NvmeSupport: 'unsupported',
  },
  EbsInfo: {
    EbsOptimizedSupport: 'unsupported',
    EncryptionSupport: 'unsupported',
    NvmeSupport: 'unsupported',
  },
  NetworkInfo: {
    NetworkPerformance: 'Moderate',
    MaximumNetworkInterfaces: 2,
    MaximumNetworkCards: 1,
    DefaultNetworkCardIndex: 0,
    NetworkCards: [
      {
        NetworkCardIndex: 0,
        NetworkPerformance: 'Moderate',
        MaximumNetworkInterfaces: 2,
      },
    ],
    Ipv4AddressesPerInterface: 6,
    Ipv6AddressesPerInterface: 0,
    Ipv6Supported: false,
    EnaSupport: 'unsupported',
    EfaSupported: false,
    EncryptionInTransitSupported: false,
  },
  PlacementGroupInfo: {
    SupportedStrategies: ['partition', 'spread'],
  },
  HibernationSupported: false,
  BurstablePerformanceSupported: false,
  DedicatedHostsSupported: false,
  AutoRecoverySupported: false,
  SupportedBootModes: ['legacy-bios'],
};
