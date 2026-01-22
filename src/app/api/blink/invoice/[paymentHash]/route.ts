import { NextRequest, NextResponse } from 'next/server';
import { APP_CONFIG } from '@/constants';

const BLINK_API_URL = APP_CONFIG.BLINK_API_URL;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentHash: string }> }
) {
  try {
    const { paymentHash } = await params;

    if (!paymentHash) {
      return NextResponse.json(
        { error: 'Payment hash required' },
        { status: 400 }
      );
    }

    // Correct query: lnInvoicePaymentStatusByHash
    const query = `
      query LnInvoicePaymentStatusByHash($input: LnInvoicePaymentStatusByHashInput!) {
        lnInvoicePaymentStatusByHash(input: $input) {
          status
        }
      }
    `;

    const response = await fetch(BLINK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.BLINK_API_KEY!,
      },
      body: JSON.stringify({
        query,
        variables: {
          input: {
            paymentHash: paymentHash,
          },
        },
      }),
    });

    const data = await response.json();

    if (data.errors) {
      console.error('Blink API error:', data.errors);
      return NextResponse.json(
        { error: 'Failed to check payment status' },
        { status: 500 }
      );
    }

    const status = data.data?.lnInvoicePaymentStatusByHash?.status;

    return NextResponse.json({
      paid: status === 'PAID',
      status: status || 'PENDING',
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
