import { config, STS } from 'aws-sdk';

type AuthErrorCode = 'CredentialsNotFound' | 'UnAuthorized';

export class AuthError extends Error {
  constructor(message: string, code: AuthErrorCode) {
    super(message);
    this.code = code;
    Object.setPrototypeOf(this, AuthError.prototype);
  }

  readonly code: AuthErrorCode;
}

export const awsCredentialsCheck = async (options?: {
  accessKeyId?: string;
  secretAccessKey?: string;
}): Promise<void> => {
  const { accessKeyId, secretAccessKey } = options || {};

  if (
    !accessKeyId &&
    !secretAccessKey &&
    !(config.credentials && config.credentials.accessKeyId) &&
    !(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  ) {
    throw new AuthError('AWS credentials unavailable.', 'CredentialsNotFound');
  }

  try {
    const sts = new STS({
      accessKeyId,
      secretAccessKey,
    });
    await sts.getCallerIdentity().promise();
  } catch (error) {
    throw new AuthError(error.message, 'UnAuthorized');
  }
};
