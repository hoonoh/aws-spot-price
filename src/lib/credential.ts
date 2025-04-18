import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

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
  const sts = new STSClient({
    credentials:
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined,
  });

  // check credential providers
  let cpAccessKeyId: string | undefined;
  let cpSecretAccessKey: string | undefined;
  try {
    ({ accessKeyId: cpAccessKeyId, secretAccessKey: cpSecretAccessKey } =
      await sts.config.credentials());
  } catch {
    //
  }

  if (
    !accessKeyId &&
    !secretAccessKey &&
    !cpAccessKeyId &&
    !cpSecretAccessKey &&
    !(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  ) {
    throw new AuthError('AWS credentials unavailable.', 'CredentialsNotFound');
  }

  try {
    await sts.send(new GetCallerIdentityCommand({}));
  } catch (error) {
    throw new AuthError((error as Error).message, 'UnAuthorized');
  }
};
