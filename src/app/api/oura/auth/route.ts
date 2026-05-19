export async function GET() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.OURA_CLIENT_ID!,
    redirect_uri: process.env.OURA_REDIRECT_URI!,
    scope: 'daily',
  })
  return Response.redirect(
    `https://cloud.ouraring.com/oauth/authorize?${params}`,
  )
}
