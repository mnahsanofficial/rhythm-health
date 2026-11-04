import { View } from 'react-native';
import { FormRow, FormRows } from './form-rows';
import { ThemeControl } from './theme';
import { Copy, Title, useStepFocus, useStyles } from './ui';

/** Everything about the account, in one place: it used to live in a menu and at the bottom of every setup step. */
export function You({ email, onEditProfile, onReminders, onExample, onSignOut }: {
  email: string; onEditProfile: () => void; onReminders: () => void; onExample: () => void; onSignOut: () => void;
}) { const ui = useStyles();
  const heading = useStepFocus('you');
  return <View style={ui.stack}>
    <Title textRef={heading}>You</Title>
    <Copy>{email}</Copy>
    <FormRows>
      <FormRow icon="hours" label="Update your rhythm" hint="Opens your answers" onPress={onEditProfile} />
      <FormRow icon="bell" label="Daily reminders" hint="Opens reminder settings" onPress={onReminders} />
      <FormRow icon="example" label="See an example" hint="Opens a finished sample experiment" onPress={onExample} />
    </FormRows>
    <ThemeControl />
    <FormRows>
      <FormRow icon="signOut" label="Sign out" hint="Signs out on this phone" onPress={onSignOut} />
    </FormRows>
  </View>;
}
