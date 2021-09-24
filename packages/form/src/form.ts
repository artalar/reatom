import { createAtom } from '@reatom/core';

export type FieldValidator<FieldValue> = (
  value: FieldValue,
  allValues: object,
  meta?: FieldState<FieldValue>,
) => any | Promise<any>;

export type FieldConfig = {
  validate: FieldValidator<any> | null;
  // possible add here subscriptions
};
export type FieldState<FieldValue> = {
  name: string;
  value: FieldValue;
  error: string | null;
  touched: boolean;
  validating: boolean;
  destroyView: boolean;
};

export type FormState<FormValues, InitialFormValues = Partial<FormValues>> = {
  initialValues: InitialFormValues;
  pristine: boolean;
  submitting: boolean;
  valid: boolean;
  invalid: boolean;
  validating: boolean;
  values: FormValues;
};

type SubmissionErrors = Record<string, any> | undefined;
export type FormConfig<FormValues = any, InitialFormValues = Partial<FormValues>> = {
  initialValues?: InitialFormValues;
  submit: (values: FormValues) => SubmissionErrors | Promise<SubmissionErrors> | void;
};

const field: FieldState<any> & FieldConfig = {
  name: '',
  value: null,
  error: null,
  touched: false,
  validate: null,
  validating: false,
  destroyView: false,
};
// @ts-ignore
const formInitial: FormState<any, any> & FormConfig & { fields: Record<string, FieldState<any> & FieldConfig> } = {
  submitting: false,
  fields: {},
};
export type CreateFormParams = {
  onSubmit: FormConfig['submit'];
  initialValues: FormConfig['initialValues'];
};
export type FieldMetaState<FieldValue> = Pick<
  FieldState<FieldValue>,
  Exclude<keyof FieldState<FieldValue>, 'name' | 'value'>
  >;

// @ts-ignore
export const mapFieldToMeta = (currentField) => ({
  error: currentField.error,
  validating: currentField.validating,
  touched: currentField.touched,
  destroyView: currentField.destroyView,
});

export const createForm = ({ onSubmit, initialValues }: CreateFormParams) => {
  const initial = { ...formInitial, submit: onSubmit, initialValues };
  return createAtom(
    {
      submit: (callback: () => void) => callback,
      initialize: (values: object) => values,
      blur: (name: string) => name,
      reset: (name: string) => name,
      focus: (name: string) => name,
      change: (name: string, value: any) => ({ name, value }),
      addField: (name: string) => name,
      destroyView: (name: string) => name,
      createView: (name: string) => name,
      setConfig: (name: string, config: FieldConfig) => ({ name, config }),
      setConfigForm: (name: string, config: FormConfig) => ({ name, config }),
      _mergeField: (name: string, newField: Partial<FieldState<any>>) => ({
        name,
        newField,
      }),
      _mergeForm: (newForm: Partial<typeof formInitial>) => newForm,
    },
    ({ onAction, schedule, create }, state = initial) => {
      let newState = state;

      const getInvalid = () =>
        Object.values(newState.fields).some(({ error, destroyView }) => (destroyView ? false : error));
      const getValues = () => ({
        ...newState.initialValues,
        ...Object.fromEntries(Object.values(newState.fields).map(({ name, value }) => [name, value])),
      });
      //TODO: add merge all field

      const mergeFieldByName = (name: string, patch: Partial<FieldState<any> & FieldConfig>) => {
        if (newState === state) {
          newState = { ...state };
        }
        if (newState.fields === state.fields) {
          newState.fields = { ...state.fields };
        }
        newState.fields[name] = { ...newState.fields[name], ...patch };
      };
      const executeValidate = (name: string) => {
        const currentField = newState.fields[name];
        const validate = currentField.validate;
        if (!validate) {
          return;
        }
        schedule(async (dispatch) => {
          const actions = [
            create('_mergeField', currentField.name, {
              validating: false,
            }),
          ];
          try {
            dispatch(
              create('_mergeField', currentField.name, {
                validating: true,
              }),
            );
            actions.push(
              create('_mergeField', currentField.name, {
                error: await validate(currentField.value, newState.values, {
                  ...mapFieldToMeta(currentField),
                  value: currentField.value,
                  name: currentField.name,
                }),
              }),
            );
          } finally {
            dispatch(actions);
          }
        });
      };
      onAction('change', ({ name, value }) => {
        mergeFieldByName(name, { value });
        executeValidate(name);
      });

      onAction('submit', (callback) => {
        schedule(async (dispatch) => {
          const actions = [
            create('_mergeForm', {
              submitting: false,
            }),
          ];
          try {
            dispatch(
              create('_mergeForm', {
                submitting: true,
                fields: Object.fromEntries(
                  Object.entries(newState.fields).map(([name, value]) => [name, { ...value, touched: true }]),
                ),
              }),
            );
            if (!getInvalid()) {
              await newState.submit(getValues());
            }
          } finally {
            dispatch(actions);
            callback();
          }
        });
      });
      onAction('reset', (name) => {
        mergeFieldByName(name, {
          ...field,
          name,
          // @ts-ignore
          value: newState.initialValues?.[name],
        });
      });
      onAction('setConfig', ({ name, config }) => {
        mergeFieldByName(name, config);
        if (config.validate) {
          executeValidate(name);
        }
      });
      onAction('addField', (name) => {
        const existField = Boolean(newState.fields[name]);
        mergeFieldByName(name, {
          ...(existField ? newState.fields[name] : field),
          name,
          // @ts-ignore
          value: newState.initialValues?.[name],
          destroyView: false,
        });
      });
      onAction('_mergeField', ({ name, newField }) => {
        mergeFieldByName(name, newField);
      });
      onAction('_mergeForm', (newForm) => {
        newState = {
          ...newState,
          ...newForm,
        };
      });
      onAction('initialize', (init) => {
        newState = {
          ...newState,
          ...{ initialValues: init },
          fields: Object.fromEntries(
            // @ts-ignore
            Object.entries(newState.fields).map(([name, value]) => [name, { ...value, value: init[name] }]),
          ),
        };
      });
      onAction('blur', (name) => {
        mergeFieldByName(name, { touched: true });
      });
      onAction('destroyView', (name) => {
        mergeFieldByName(name, { destroyView: true });
      });
      onAction('createView', (name) => {
        mergeFieldByName(name, { destroyView: false });
      });
      const invalid = getInvalid();
      return {
        ...newState,
        valid: !invalid,
        invalid,
        values: getValues(),
        // @ts-ignore
        pristine: Object.entries(newState.fields).every(([name, { value }]) => newState.initialValues[name] === value),
        validating: Object.values(newState.fields).some(({ validating }) => validating),
      };
    },
  );
};
