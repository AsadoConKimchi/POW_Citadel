import { NextRequest, NextResponse } from 'next/server';
import { APP_CONFIG } from '@/constants';

const BLINK_API_URL = APP_CONFIG.BLINK_API_URL;

export async function POST(request: NextRequest) {
  try {
    const { amount, memo } = await request.json();

    console.log('Invoice request:', { amount, memo });
    console.log('BLINK_API_KEY exists:', !!process.env.BLINK_API_KEY);
    console.log('BLINK_WALLET_ID:', process.env.BLINK_WALLET_ID);

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const query = `
      mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
        lnInvoiceCreate(input: $input) {
          invoice {
            paymentRequest
            paymentHash
            satoshis
          }
          errors {
            message
          }
        }
      }
    `;

    const requestBody = {
      query,
      variables: {
        input: {
          walletId: process.env.BLINK_WALLET_ID,
          amount,
          memo: memo || 'Citadel POW 기부',
          expiresIn: APP_CONFIG.INVOICE_EXPIRY_SECONDS,
        },
      },
    };

    console.log('Blink request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(BLINK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.BLINK_API_KEY!,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Blink response status:', response.status);
    console.log('Blink response:', responseText);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to create invoice' },
        { status: 500 }
      );
    }

    const data = JSON.parse(responseText);

    if (data.errors || data.data?.lnInvoiceCreate?.errors?.length > 0) {
      console.error('Blink GraphQL error:', data.errors || data.data.lnInvoiceCreate.errors);
      return NextResponse.json(
        { error: 'Failed to create invoice' },
        { status: 500 }
      );
    }

    const invoice = data.data.lnInvoiceCreate.invoice;

    return NextResponse.json({
      paymentRequest: invoice.paymentRequest,
      paymentHash: invoice.paymentHash,
      expiresAt: new Date(Date.now() + APP_CONFIG.INVOICE_EXPIRY_SECONDS * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Invoice creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
