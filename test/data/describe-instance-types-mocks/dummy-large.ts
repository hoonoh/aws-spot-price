import { InstanceTypeInfo } from '@aws-sdk/client-ec2';

export const dummyLarge: InstanceTypeInfo = {
  AutoRecoverySupported: true,
  BareMetal: false,
  BurstablePerformanceSupported: false,
  CurrentGeneration: true,
  DedicatedHostsSupported: true,
  EbsInfo: {
    EbsOptimizedInfo: {
      BaselineBandwidthInMbps: 650,
      BaselineIops: 3000,
      BaselineThroughputInMBps: 81.25,
      MaximumBandwidthInMbps: 4750,
      MaximumIops: 15000,
      MaximumThroughputInMBps: 593.75,
    },
    EbsOptimizedSupport: 'default',
    EncryptionSupport: 'supported',
    NvmeSupport: 'required',
  },
  FreeTierEligible: false,
  HibernationSupported: false,
  Hypervisor: 'nitro',
  InstanceStorageSupported: false,
  InstanceType: 'dummy.large',
  MemoryInfo: {
    SizeInMiB: 16384,
  },
  NetworkInfo: {
    DefaultNetworkCardIndex: 0,
    EfaSupported: false,
    EnaSupport: 'required',
    Ipv4AddressesPerInterface: 10,
    Ipv6AddressesPerInterface: 10,
    Ipv6Supported: true,
    MaximumNetworkCards: 1,
    MaximumNetworkInterfaces: 3,
    NetworkCards: [
      {
        MaximumNetworkInterfaces: 3,
        NetworkCardIndex: 0,
        NetworkPerformance: 'Up to 25 Gigabit',
      },
    ],
    NetworkPerformance: 'Up to 25 Gigabit',
  },
  PlacementGroupInfo: {
    SupportedStrategies: ['cluster', 'partition', 'spread'],
  },
  ProcessorInfo: {
    SupportedArchitectures: ['x86_64'],
    SustainedClockSpeedInGhz: 3.1,
  },
  SupportedBootModes: ['legacy-bios', 'uefi'],
  SupportedRootDeviceTypes: ['ebs'],
  SupportedUsageClasses: ['on-demand', 'spot'],
  SupportedVirtualizationTypes: ['hvm'],
  VCpuInfo: {
    DefaultCores: 1,
    DefaultThreadsPerCore: 2,
    DefaultVCpus: 2,
    ValidCores: [1],
    ValidThreadsPerCore: [1, 2],
  },
};
