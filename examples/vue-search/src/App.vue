<script setup lang="ts">
import { reatomRef } from '@reatom/npm-vue'
import * as model from './model'
import { useQuasar } from 'quasar'
import { effect } from 'vue'

const search = reatomRef(model.searchAtom)
const issuesPending = reatomRef(model.issues.pendingAtom)
const issues = reatomRef(model.issues.dataAtom)
const issuesError = reatomRef(model.issues.errorAtom)

const $q = useQuasar()

effect(() => {
  if (!issuesError.value) return
  $q.notify({
    type: 'negative',
    icon: undefined,
    message: String(issuesError.value),
  })
})

const issueCreatedAt = (issue: model.Issue) => {
  return new Date((issue as any).created_at).toLocaleDateString()
}
</script>

<template>
  <q-layout>
    <q-page-container>
      <main>
        <q-input
          v-model="search"
          :loading="issuesPending > 0"
          label="Search issues"
          rounded
        ></q-input>
        <template v-for="issue of issues">
          <q-card flat bordered>
            <q-card-section class="issue-title">
              <q-avatar size="sm">
                <img :src="issue.user.avatar_url" :alt="issue.user.login" />
              </q-avatar>
              <a
                class="issue-link text-primary text-lg"
                :href="issue.html_url"
                >{{ issue.title }}</a
              >
            </q-card-section>
            <q-separator> </q-separator>
            <q-card-section>
              <span class="issue-status">
                #{{ issue.number }} opened on {{ issueCreatedAt(issue) }}
              </span>
            </q-card-section>
          </q-card>
        </template>
      </main>
    </q-page-container>
  </q-layout>
</template>

<style scoped lang="scss">
main {
  display: flex;
  flex-direction: column;
  align-items: center;

  padding: 1rem;
  gap: 1rem;
}

main > * {
  width: 100%;
  max-width: 600px;
}

.issue-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.issue-link {
  text-decoration: none;
}

.issue-status {
  opacity: 0.5;
}
</style>
