export const jwtConfig = {
  issuer: required('JWT_ISSUER'),
  audience: required('JWT_AUDIENCE'),
  access: {
    secret: required('JWT_ACCESS_SECRET'),
    expiresIn: '15m' as const,
  },
  refresh: {
    secret: required('JWT_REFRESH_SECRET'),
    expiresIn: '30d' as const,
  },
};

function required(name: string) {
  const value = process.env?.[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export const refreshSignOptions = {
  secret: jwtConfig.refresh.secret,
  expiresIn: jwtConfig.refresh.expiresIn,
  issuer: jwtConfig.issuer,
  audience: jwtConfig.audience,
};
