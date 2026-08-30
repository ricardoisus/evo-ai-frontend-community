import CustomAttributesForm from '@/components/customAttributes/CustomAttributesForm';

interface CustomAttributesProps {
  attributes: Record<string, unknown>;
  onAttributesChange: (attributes: Record<string, unknown>) => void;
  disabled?: boolean;
  attributeModel?: 'contact_attribute' | 'company_attribute';
}

/**
 * CustomAttributes component for contacts form.
 * Wrapper around the generic CustomAttributesForm component.
 */
export default function CustomAttributes({
  attributes,
  onAttributesChange,
  disabled = false,
  attributeModel = 'contact_attribute',
}: CustomAttributesProps) {
  return (
    <CustomAttributesForm
      attributeModel={attributeModel}
      attributes={attributes}
      mode="form"
      onAttributesChange={onAttributesChange}
      disabled={disabled}
    />
  );
}
