import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { Credentials } from '@aws-sdk/types';

type AuthErrorCode = 'CredentialsNotFound' | 'UnAuthorized';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isAuthError = (error: any): error is AuthError => {
  return error.authError === 'authError';
};

export class AuthError extends Error {
  readonly authError = 'authError';

  constructor(message: string, readonly code: AuthErrorCode) {
    super(message) /* istanbul ignore next */;
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

export const awsCredentialsCheck = async ({
  accessKeyId,
  secretAccessKey,
  regionOrSTSClient,
}: {
  accessKeyId?: string;
  secretAccessKey?: string;
  regionOrSTSClient?: string | STSClient;
} = {}): Promise<void> => {
  const stsClient =
    typeof regionOrSTSClient === 'object'
      ? regionOrSTSClient
      : new STSClient({
          region: regionOrSTSClient || 'aws-global',
          credentials:
            accessKeyId && secretAccessKey
              ? {
                  accessKeyId,
                  secretAccessKey,
                }
              : undefined,
        });

  let credentials: Credentials | undefined;
  try {
    credentials = await stsClient.config.credentials();
  } catch (error) {
    //
  }

  if (
    !accessKeyId &&
    !secretAccessKey &&
    !credentials &&
    !(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  ) {
    throw new AuthError('AWS credentials unavailable.', 'CredentialsNotFound');
  }

  try {
    await stsClient.send(new GetCallerIdentityCommand({}));
  } catch (error) {
    throw new AuthError((error as Error).message, 'UnAuthorized');
  }
};
