import { Html, Head, Preview, Body, Container, Text, Section } from "@react-email/components";
import * as React from "react";

export function OrderRefund(props: {
  tenantName: string;
  parentName: string;
  orderId: string;
  amountAud: string;
  isFullRefund: boolean;
}) {
  return (
    <Html>
      <Head />
      <Preview>{`Refund processed for order ${props.orderId}`}</Preview>
      <Body style={{ fontFamily: "Inter, sans-serif", background: "#FAF6EE" }}>
        <Container style={{ background: "#FDFBF6", padding: 24, maxWidth: 560 }}>
          <Text>Hi {props.parentName},</Text>
          <Section>
            {props.isFullRefund ? (
              <Text>
                Your order <strong>{props.orderId}</strong> has been refunded for{" "}
                <strong>{props.amountAud}</strong>. The funds will return to your card
                within 5–10 business days.
              </Text>
            ) : (
              <Text>
                A partial refund of <strong>{props.amountAud}</strong> has been processed
                for order <strong>{props.orderId}</strong>. The remaining balance has not
                been refunded.
              </Text>
            )}
          </Section>
          <Text>If you have any questions, please reply to this email.</Text>
          <Text>
            Thank you,
            <br />
            {props.tenantName} Uniform Shop
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
