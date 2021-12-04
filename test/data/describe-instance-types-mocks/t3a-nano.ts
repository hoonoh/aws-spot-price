import { InstanceTypeInfo } from '@aws-sdk/client-ec2';

export const t3aNano: InstanceTypeInfo = {
  InstanceType: 't3a.nano',
  CurrentGeneration: true,
  FreeTierEligible: false,
  SupportedUsageClasses: ['on-demand', 'spot'],
  SupportedRootDeviceTypes: ['ebs'],
  SupportedVirtualizationTypes: ['hvm'],
  BareMetal: false,
  Hypervisor: 'nitro',
  ProcessorInfo: {
    SupportedArchitectures: ['x86_64'],
    SustainedClockSpeedInGhz: 2.2,
  },
  VCpuInfo: {
    // DefaultVCpus: 2,
    DefaultVCpus: 4,
    DefaultCores: 1,
    DefaultThreadsPerCore: 2,
    ValidCores: [1],
    ValidThreadsPerCore: [1, 2],
  },
  MemoryInfo: {
    // SizeInMiB: 512,
    SizeInMiB: 1024,
  },
  InstanceStorageSupported: false,
  EbsInfo: {
    EbsOptimizedSupport: 'default',
    EncryptionSupport: 'supported',
    EbsOptimizedInfo: {
      BaselineBandwidthInMbps: 45,
      BaselineThroughputInMBps: 5.625,
      BaselineIops: 250,
      MaximumBandwidthInMbps: 2085,
      MaximumThroughputInMBps: 260.625,
      MaximumIops: 11800,
    },
    NvmeSupport: 'required',
  },
  NetworkInfo: {
    NetworkPerformance: 'Up to 5 Gigabit',
    MaximumNetworkInterfaces: 2,
    MaximumNetworkCards: 1,
    DefaultNetworkCardIndex: 0,
    NetworkCards: [
      {
        NetworkCardIndex: 0,
        NetworkPerformance: 'Up to 5 Gigabit',
        MaximumNetworkInterfaces: 2,
      },
    ],
    Ipv4AddressesPerInterface: 2,
    Ipv6AddressesPerInterface: 2,
    Ipv6Supported: true,
    EnaSupport: 'required',
    EfaSupported: false,
    EncryptionInTransitSupported: false,
  },
  PlacementGroupInfo: {
    SupportedStrategies: ['partition', 'spread'],
  },
  HibernationSupported: true,
  BurstablePerformanceSupported: true,
  DedicatedHostsSupported: false,
  AutoRecoverySupported: true,
  SupportedBootModes: ['legacy-bios', 'uefi'],
};
