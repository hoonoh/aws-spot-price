import STS from 'aws-sdk/clients/sts';

type AuthErrorCode = 'CredentialsNotFound' | 'UnAuthorized';

export class AuthError extends Error {
  constructor(message: string, code: AuthErrorCode) {
    super(message) /* istanbul ignore next */;
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
  const sts = new STS({
    accessKeyId,
    secretAccessKey,
  });
  if (
    !accessKeyId &&
    !secretAccessKey &&
    !sts.config.credentials &&
    !(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  ) {
    throw new AuthError('AWS credentials unavailable.', 'CredentialsNotFound');
  }

  try {
    await sts.getCallerIdentity().promise();
  } catch (error) {
    throw new AuthError(error.message, 'UnAuthorized');
  }
};
