import { NextResponse } from 'next/server';
import { APP_CONFIG } from '@/constants';

const BLINK_API_URL = APP_CONFIG.BLINK_API_URL;

export async function GET() {
  try {
    // Introspection query to find available queries
    const query = `
      query IntrospectionQuery {
        __schema {
          queryType {
            fields {
              name
              args {
                name
                type {
                  name
                  kind
                  ofType {
                    name
                    kind
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(BLINK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.BLINK_API_KEY!,
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();

    // Filter to find invoice-related queries
    const fields = data.data?.__schema?.queryType?.fields || [];
    const invoiceQueries = fields.filter((f: any) =>
      f.name.toLowerCase().includes('invoice') ||
      f.name.toLowerCase().includes('ln') ||
      f.name.toLowerCase().includes('payment')
    );

    return NextResponse.json({
      allQueries: fields.map((f: any) => f.name),
      invoiceRelated: invoiceQueries,
    });
  } catch (error) {
    console.error('Introspection error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
