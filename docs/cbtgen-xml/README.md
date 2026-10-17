# CBTGen XML v1.0 Package

Files:

- CBTGen-XML-Schema-v1.0.xsd
  Machine-readable structural schema.

- CBTGen-AI-Conversion-Prompt-v1.0.md
  Official universal conversion prompt for turning a source question paper
  into CBTGen XML.

- CBTGen-XML-Semantic-Validation-v1.0.md
  Application-level rules that XSD alone cannot enforce.

- CBTGen-Sample-v1.0.xml
  Complete sample demonstrating MCQ, MSQ, NAT, MATCH and passage-linked MCQ.

## Validation architecture

1. Parse XML.
2. Validate against XSD.
3. Run semantic validation.
4. Resolve all cross references.
5. Run source-fidelity/review checks.
6. Calculate question-level fingerprints.
7. Calculate paper-level fingerprint.
8. Apply user-scoped pack/slot/usage rules.
9. Create an authorized CBT session.
10. Randomize presentation only at session creation.

## Important boundary

The XML is source-paper data. It must never be used as the authority for
user identity, pack state, slot state, attempt count, session state or score.

Those values belong to the authenticated server/session layer.
