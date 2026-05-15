import { Html, Head, Preview, Body, Container, Text, Section } from "@react-email/components";
import * as React from "react";

export function OrderHold(props: {
  tenantName: string;
  parentName: string;
  orderId: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{`Update on order ${props.orderId}`}</Preview>
      <Body style={{ fontFamily: "Inter, sans-serif", background: "#FAF6EE" }}>
        <Container style={{ background: "#FDFBF6", padding: 24, maxWidth: 560 }}>
          <Text>Hi {props.parentName},</Text>
          <Section>
            <Text>
              We&apos;ve hit a small issue with order <strong>{props.orderId}</strong>.
              Please hold off on pickup. We&apos;ll be in touch as soon as it&apos;s ready.
            </Text>
          </Section>
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
